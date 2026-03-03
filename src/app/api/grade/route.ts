import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { gradeSubmission, fetchToBuffer } from '@/lib/grading';
import { buildBreakdownHtml } from '@/lib/email-helpers';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { submissionId, sendEmail: clientSendEmail } = await req.json();

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
    const { title, is_socratic, auto_send_emails } = assignment;

    // Use array if provided, fallback to standard field
    const activeFileUrls = file_urls && file_urls.length > 0 ? file_urls : [file_url];

    // 2. Call shared grading logic
    const result = await gradeSubmission(activeFileUrls, assignment);

    // Default to true if clientSendEmail is not provided
    const shouldSendEmail = assignment.auto_send_emails !== false && (clientSendEmail !== false);

    // 3. Update the Submission in Supabase
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        score: result.Score,
        feedback: result.Feedback,
        status: 'graded',
        email_sent: shouldSendEmail,
        category_scores: result.CategoryScores || null,
        skill_assessments: result.SkillAssessments || null,
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('Failed to update submission status:', updateError);
    }

    // 4. Send Email via Resend (if auto-send is enabled)
    if (shouldSendEmail) {
      try {
        const breakdownHtml = buildBreakdownHtml(result.CategoryScores, result.SkillAssessments);
        await resend.emails.send({
          from: 'TitanGrade <teacher@titangrade.org>',
          to: [student_email],
          subject: `Your Grade for ${title} is ready!`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #4f46e5;">TitanGrade Feedback</h2>
              <p>Hello ${student_name},</p>
              <p>Great effort on <strong>${title}</strong>! Here is your personalized feedback from the AI:</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h1 style="margin-top: 0; color: #111827;">Score: ${result.Score}</h1>
                <h3 style="margin-bottom: 5px;">Feedback:</h3>
                <p style="margin-top: 0; line-height: 1.5;">${result.Feedback}</p>
                
                ${breakdownHtml}
                
                ${!is_socratic ? `
                <details style="margin-top: 15px;">
                  <summary style="cursor: pointer; color: #4f46e5; font-weight: bold;">View Grading Details</summary>
                  
                  <h4 style="margin-top: 10px; margin-bottom: 5px;">1. AI Extracted Answers</h4>
                  <ul style="margin-top: 5px; padding-left: 20px; color: #555; margin-bottom: 10px;">
                    ${result.Transcription.map(step => `<li style="margin-bottom: 5px;">${step}</li>`).join('')}
                  </ul>

                  <h4 style="margin-top: 10px; margin-bottom: 5px;">2. AI Scoring Reasoning</h4>
                  <ul style="margin-top: 5px; padding-left: 20px; color: #555;">
                    ${result.Reasoning.map(step => `<li style="margin-bottom: 5px;">${step}</li>`).join('')}
                  </ul>
                </details>
                ` : ''}
              </div>
              
              <p>Remember: every scientist improves through iteration. Apply this feedback, and your next submission will be even stronger!</p>
              <br/>
              <p>Keep experimenting,<br/>Your Science Teacher</p>
            </div>
          `,
        });
      } catch (emailErr: unknown) {
        const err = emailErr as Error;
        console.error('Failed to send email:', err);
      }
    }

    return NextResponse.json({
      success: true,
      score: result.Score,
      feedback: result.Feedback,
      categoryScores: result.CategoryScores,
      skillAssessments: result.SkillAssessments,
      transcription: result.Transcription,
      reasoning: result.Reasoning
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Grading API Error:', err);

    // Update status to error if something failed hard
    try {
      const { submissionId } = await req.clone().json();
      if (submissionId) {
        await supabase.from('submissions').update({ status: 'error' }).eq('id', submissionId);
      }
    } catch {
      // Ignored
    }

    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
