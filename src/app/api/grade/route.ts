import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { submissionId } = await req.json();

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    // 1. Fetch submission details
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select('*, assignment:assignments(*)')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      throw new Error('Submission not found');
    }

    const { file_url, file_urls, student_email, student_name, assignment } = submission;
    const { rubric, rubrics, max_score, title, grading_framework, exemplar_url, exemplar_urls } = assignment;

    // Use array if provided, fallback to standard field
    const activeFileUrls = file_urls && file_urls.length > 0 ? file_urls : [file_url];
    const activeRubrics = rubrics && rubrics.length > 0 ? rubrics : [rubric];
    const activeExemplars = exemplar_urls && exemplar_urls.length > 0 ? exemplar_urls : (exemplar_url ? [exemplar_url] : []);

    // Helper to fetch file and make it a buffer
    const fetchToBuffer = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch file at ${url}`);
      return {
        buffer: Buffer.from(await res.arrayBuffer()),
        mimeType: res.headers.get('content-type') || 'application/pdf'
      };
    };

    // 2. Download all files concurrently
    const studentFiles = await Promise.all(activeFileUrls.map(fetchToBuffer));

    let frameworkInstructions = "";
    if (grading_framework === 'marzano') {
      frameworkInstructions = `
      GRADING FRAMEWORK (Marzano 4.0 Scale):
      You MUST use the strict Marzano proficiency scale:
      - 4.0 (Advanced): Exceeds standard, applies knowledge in new contexts.
      - 3.0 (Proficient): Meets the standard perfectly (Target score).
      - 2.0 (Approaching): Understands basic concepts but misses complex applications.
      - 1.0 (Beginning): Cannot complete task without help.
      - 0.0: No evidence of learning.
      *Use half points (e.g. 2.5, 3.5) if appropriate.*
      `;
    }

    // 3. Call Gemini 2.5 Flash for Grading
    let systemPrompt = `You are an elite, encouraging Science Teacher grading a student's assignment titled "${title}".
    Your job:
    1. STRICT VISUAL EXTRACTION (Context-Aware): Scan the document line-by-line. If an Exemplar Answer Key is provided, you MUST look at what the correct answer is first to establish context for what messy handwriting might say (e.g., if the key says 'Arsenic', use that context to decipher a scribbled word). 
       - FOR EVERY QUESTION: State the question number.
       - TRANSCRIBE: State exactly what you see. 
       - FOR MULTIPLE CHOICE: You MUST explicitly look at every single printed option and confirm or deny handwriting. Think: "Is there a pencil mark on A? No. On B? Yes. On C? No." Only then, state "Question X: Circled B".
       - IF THERE IS NO HANDWRITTEN MARK: You MUST explicitly state "Question X: BLANK". Warning: Do not mistake scanner artifacts or smudges for circles. Hallucinating marks that are not there is strictly forbidden.
    2. EVALUATION: Compare the extracted answers against the rubric and/or exemplar.
    3. FEEDBACK: Be specific, constructive, and motivating.
    
    CRITICAL ANTI-HALLUCINATION RULES:
    - Never guess what the student "meant" to circle. Only grade the markings physically present on the page.
    - If comparing to an Exemplar, do a direct matching: Student Answer vs Exemplar Answer.
    - Quote the exact text the student wrote when evaluating their reasoning.
    
    ${frameworkInstructions}
    
    RUBRIC (Max Score: ${max_score}):
    ${activeRubrics.join("\n\n---\n\n")}`;

    // 4. Construct AI context
    const studentFileParts = studentFiles.map(sf => ({
      type: 'file' as const,
      data: sf.buffer,
      mediaType: sf.mimeType,
    }));

    const aiMessages: any[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Student Submission Attached:' },
          ...studentFileParts,
        ]
      }
    ];

    if (activeExemplars.length > 0) {
      const execFiles = await Promise.all(activeExemplars.map(fetchToBuffer));
      const execFileParts = execFiles.map(ef => ({
        type: 'file' as const,
        data: ef.buffer,
        mediaType: ef.mimeType,
      }));

      aiMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'PERFECT ANSWER KEY EXEMPLAR Attached. Use this to benchmark the student against.' },
          ...execFileParts,
        ]
      });
    }

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: aiMessages,
      schema: z.object({
        Transcription: z.array(z.string()).describe("A physical visual extraction step. For each question: 1) Identify question number. 2) If Exemplar exists, note the expected answer. 3) Search area for physical marks. 4) Use expected answer as context to decode messy handwriting. 5) For multiple choice, explicitly dismiss unmarked options before declaring one is circled. 6) If blank, state 'BLANK'. Do not hallucinate."),
        Reasoning: z.array(z.string()).describe("Step-by-step reasoning comparing the Transcription vs the Rubric/Exemplar, then mapping to a score. Do not guess or hallucinate answers."),
        Score: z.string().describe(`The numeric score the student achieved out of ${max_score}. E.g. "85" or "3.5"`),
        Feedback: z.string().describe('2-4 sentences: specific, encouraging, actionable, rubric-referenced feedback'),
      }),
    });

    const aiScore = `${object.Score}/${max_score}`;
    const aiFeedback = object.Feedback;

    // 4. Update the Submission in Supabase
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        score: aiScore,
        feedback: aiFeedback,
        status: 'graded',
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Failed to update submission status:', updateError);
      // We don't throw here so we can still try to email the student
    }

    // 5. Send Email via Resend
    try {
      await resend.emails.send({
        from: 'TitanGrade <onboarding@resend.dev>', // Replace with your verified domain in production
        to: [student_email],
        subject: `Your Grade for ${title} is ready!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #4f46e5;">TitanGrade Feedback</h2>
            <p>Hello ${student_name},</p>
            <p>Great effort on <strong>${title}</strong>! Here is your personalized feedback from the AI:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h1 style="margin-top: 0; color: #111827;">Score: ${aiScore}</h1>
              <h3 style="margin-bottom: 5px;">Feedback:</h3>
              <p style="margin-top: 0; line-height: 1.5;">${aiFeedback}</p>
              
              <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #4f46e5; font-weight: bold;">View Grading Details</summary>
                
                <h4 style="margin-top: 10px; margin-bottom: 5px;">1. AI Extracted Answers</h4>
                <ul style="margin-top: 5px; padding-left: 20px; color: #555; margin-bottom: 10px;">
                  ${object.Transcription.map(step => `<li style="margin-bottom: 5px;">${step}</li>`).join('')}
                </ul>

                <h4 style="margin-top: 10px; margin-bottom: 5px;">2. AI Scoring Reasoning</h4>
                <ul style="margin-top: 5px; padding-left: 20px; color: #555;">
                  ${object.Reasoning.map(step => `<li style="margin-bottom: 5px;">${step}</li>`).join('')}
                </ul>
              </details>
            </div>
            
            <p>Remember: every scientist improves through iteration. Apply this feedback, and your next submission will be even stronger!</p>
            <br/>
            <p>Keep experimenting,<br/>Your Science Teacher</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr);
    }

    return NextResponse.json({ success: true, score: aiScore });

  } catch (error: any) {
    console.error('Grading API Error:', error);

    // Update status to error if something failed hard
    try {
      const { submissionId } = await req.clone().json();
      if (submissionId) {
        await supabase.from('submissions').update({ status: 'error' }).eq('id', submissionId);
      }
    } catch (e) { }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
