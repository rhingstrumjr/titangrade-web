import { supabase } from '@/lib/supabase';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Shared types
export interface GradeResult {
  Score: string;
  Feedback: string;
  Transcription: string[];
  Reasoning: string[];
}

export interface AssignmentData {
  id: string;
  title: string;
  rubric: string;
  rubrics?: string[];
  max_score: number;
  grading_framework: 'standard' | 'marzano';
  exemplar_url?: string;
  exemplar_urls?: string[];
  is_socratic: boolean;
  auto_send_emails: boolean;
}

// Helper to fetch file and make it a buffer
export async function fetchToBuffer(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file at ${url}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    mimeType: res.headers.get('content-type') || 'application/pdf'
  };
}

/**
 * Core grading logic — calls Gemini 2.5 Flash to grade a single submission.
 * Used by both /api/grade (initial grading) and /api/regrade (exemplar-calibrated regrading).
 */
export async function gradeSubmission(
  fileUrls: string[],
  assignment: AssignmentData,
): Promise<GradeResult> {
  const { rubric, rubrics, max_score, title, grading_framework, exemplar_url, exemplar_urls, is_socratic } = assignment;

  const activeRubrics = rubrics && rubrics.length > 0 ? rubrics : [rubric];
  const activeExemplars = exemplar_urls && exemplar_urls.length > 0
    ? exemplar_urls
    : (exemplar_url ? [exemplar_url] : []);

  // Separate text-based rubrics from file-based rubrics (URLs)
  const textRubrics = activeRubrics.filter(r => r && !r.startsWith('http'));
  const fileRubrics = activeRubrics.filter(r => r && r.startsWith('http'));

  // Download all student files concurrently
  const studentFiles = await Promise.all(fileUrls.map(fetchToBuffer));

  // Download rubric files (so Gemini can actually SEE them, not just see a URL string)
  const rubricFiles = await Promise.all(
    fileRubrics.map(async (url) => {
      try {
        return await fetchToBuffer(url);
      } catch (e) {
        console.error("Failed to fetch rubric file:", url, e);
        return null;
      }
    })
  ).then(results => results.filter(r => r !== null));

  // Fetch Dynamic Student Exemplars
  const { data: studentExemplars } = await supabase
    .from('submissions')
    .select('*')
    .eq('assignment_id', assignment.id)
    .eq('is_exemplar', true);

  let frameworkInstructions = "";
  if (grading_framework === 'marzano') {
    frameworkInstructions = `
    GRADING FRAMEWORK (Marzano 4.0 Proficiency Scale):
    
    VALID SCORES: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0
    You MUST output one of these exact values. No other scores are allowed.

    MARZANO TEST STRUCTURE:
    Tests are organized into sections by proficiency level. Section headers on the test (e.g., "Level 2.0", "Level 3.0") indicate which proficiency level those questions assess:
    - Level 2.0 questions → Foundational/vocabulary knowledge
    - Level 3.0 questions → Target learning goal (the standard being measured)
    - Level 4.0 questions → Transfer/application beyond what was directly taught

    SCORING DECISION TREE — follow this step-by-step:
    
    Step 1: Count how many questions were answered correctly in EACH section.
    Step 2: Calculate the percentage correct for each section.
    Step 3: Assign the score using this chart:

    ┌────────┬──────────────┬──────────────┬──────────────┬──────────────────────────┐
    │ SCORE  │ Level 2.0    │ Level 3.0    │ Level 4.0    │ What it means            │
    ├────────┼──────────────┼──────────────┼──────────────┼──────────────────────────┤
    │  4.0   │ All correct  │ All correct  │ All correct  │ Exceeds the standard     │
    │  3.5   │ All correct  │ All correct  │ Some correct │ Proficient + some transfer│
    │  3.0   │ All correct  │ All correct  │ None/N/A     │ Meets the standard       │
    │  2.5   │ All correct  │ Most correct │ —            │ Almost proficient        │
    │  2.0   │ All correct  │ Few/none     │ —            │ Foundational only        │
    │  1.5   │ Most correct │ Few/none     │ —            │ Partial foundations      │
    │  1.0   │ Some correct │ None         │ —            │ Beginning understanding  │
    │  0.5   │ Few correct  │ None         │ —            │ Minimal evidence         │
    │  0.0   │ None correct │ None         │ —            │ No evidence of learning  │
    └────────┴──────────────┴──────────────┴──────────────┴──────────────────────────┘

    KEY DEFINITIONS:
    - "All correct" = 100% of questions in that section
    - "Most correct" = 60-90% of questions in that section  
    - "Some correct" = 30-60% of questions in that section
    - "Few correct" = less than 30% of questions in that section

    CRITICAL SCORING RULES:
    1. A student CANNOT score 3.0 or above if ANY Level 2.0 questions are wrong. Level 2.0 mastery is a prerequisite.
    2. The 2.5 boundary is key: ALL of Level 2.0 must be correct AND MOST (but not all) Level 3.0 must be correct.
    3. If the test has no explicit Level 4.0 section, the maximum score is 3.0.
    4. When in doubt between two adjacent scores, check if Teacher Exemplars exist and match their scoring patterns.
    5. In your Reasoning, you MUST explicitly state: "Level 2.0: X/Y correct. Level 3.0: X/Y correct. Level 4.0: X/Y correct. → Score: Z"
    `;

  }

  const socraticInstructions = is_socratic ? `
  🚨 CRITICAL SOCRATIC TUTOR DIRECTIVE 🚨
  The teacher has enabled Socratic Tutor Mode. YOU MUST NEVER REVEAL THE CORRECT ANSWER DIRECTLY if the student got it wrong.
  Instead of stating the correct answer or explicitly correcting them, you must ask a guiding question, point out a logical flaw, or refer them back to a specific concept to help them realize their own mistake. 
  Your feedback must act like a 1-on-1 tutor guiding them to the 'aha' moment. Focus heavily on 'What did they confuse?' and 'How can I gently nudge them?'
  ` : ``;

  // Build rubric text for system prompt (only text-based rubrics go here)
  const rubricTextBlock = textRubrics.length > 0
    ? `\n  RUBRIC (Max Score: ${max_score}):\n  ${textRubrics.join("\n\n---\n\n")}`
    : (rubricFiles.length > 0
      ? `\n  RUBRIC: See the attached rubric document(s). Grade strictly according to the criteria shown. Max Score: ${max_score}.`
      : `\n  RUBRIC (Max Score: ${max_score}): Grade based on quality, completeness, and accuracy.`);

  // Build system prompt
  const systemPrompt = `You are a meticulous Science Teacher grading a student's assignment titled "${title}".
  
  SCORING BEHAVIOR: Grade strictly by the rubric with NO generosity bias. If work is missing, the score for that section is 0 — do not give partial credit for "effort" or "attempting." Only the rubric criteria determine the score.
  
  FEEDBACK BEHAVIOR: Your written feedback should be warm, specific, and encouraging. Always point to exactly one concrete action the student can take to improve. Reference specific questions or sections.

  GRADING PROCESS:
  1. STRICT VISUAL EXTRACTION (Context-Aware): Scan the document line-by-line. If an Exemplar Answer Key is provided, you MUST look at what the correct answer is first to establish context for what messy handwriting might say (e.g., if the key says 'Arsenic', use that context to decipher a scribbled word). 
     - FOR EVERY QUESTION: State the question number.
     - TRANSCRIBE: State exactly what you see. 
     - FOR MULTIPLE CHOICE: You MUST check every option individually:
       WRONG: "Question 5: The student circled C" (no evidence for ruling out A, B, D)
       RIGHT: "Question 5: Option A — no mark. Option B — no mark. Option C — clear pencil circle. Option D — no mark. ANSWER: C"
     - IF THERE IS NO HANDWRITTEN MARK: You MUST explicitly state "Question X: BLANK". Warning: Do not mistake scanner artifacts or smudges for circles. Hallucinating marks that are not there is strictly forbidden.
  2. SELF-CHECK: After transcription, review each extracted answer. Confirm: does this match what I physically see? Did I mark anything blank that might have a faint mark? Did I mark anything answered that might be blank? State any corrections.
  3. EVALUATION: Compare the verified answers against the rubric and/or exemplar.
  4. FEEDBACK: Be specific, constructive, and motivating.
  
  CRITICAL ANTI-HALLUCINATION RULES:
  - Never guess what the student "meant" to circle. Only grade the markings physically present on the page.
  - If comparing to an Exemplar, do a direct matching: Student Answer vs Exemplar Answer.
  - Quote the exact text the student wrote when evaluating their reasoning.
  ${socraticInstructions}
  
  ${frameworkInstructions}
  ${rubricTextBlock}`;

  // Build AI message context
  const studentFileParts = studentFiles.map(sf => ({
    type: 'file' as const,
    data: sf.buffer.toString('base64'),
    mediaType: sf.mimeType,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aiMessages: any[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Student Submission Attached:' },
        ...studentFileParts,
      ]
    }
  ];

  // Attach rubric files as visual content (so Gemini can actually SEE published PDFs/images)
  if (rubricFiles.length > 0) {
    const rubricFileParts = rubricFiles.map(rf => ({
      type: 'file' as const,
      data: rf!.buffer.toString('base64'),
      mediaType: rf!.mimeType,
    }));

    aiMessages.push({
      role: 'user',
      content: [
        { type: 'text', text: 'GRADING RUBRIC DOCUMENT — Grade the student strictly according to this rubric. Every criterion, point value, and category in this document must be applied:' },
        ...rubricFileParts,
      ]
    });
  }

  // Add teacher exemplar files
  if (activeExemplars.length > 0) {
    const execFiles = await Promise.all(activeExemplars.map(fetchToBuffer));
    const execFileParts = execFiles.map(ef => ({
      type: 'file' as const,
      data: ef.buffer.toString('base64'),
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

  // Add student exemplars (teacher-starred submissions)
  if (studentExemplars && studentExemplars.length > 0) {
    for (const ex of studentExemplars) {
      if (!ex.file_url) continue;
      try {
        const exFile = await fetchToBuffer(ex.file_url);
        aiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: `TEACHER APPROVED STUDENT EXEMPLAR:\nThe following attached document is a past student submission that the teacher explicitly marked as a grading exemplar.\nThe teacher gave this submission a SCORE of: ${ex.score}\nThe teacher gave this submission FEEDBACK of: "${ex.feedback}"\nAnalyze this exemplar to understand EXACTLY how the teacher grades this assignment, and mimic this style, stringency, and feedback tone for the current student.` },
            { type: 'file' as const, data: exFile.buffer.toString('base64'), mediaType: exFile.mimeType },
          ]
        });
      } catch (e) {
        console.error("Failed to load student exemplar", e);
      }
    }
  }

  // Call Gemini
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

  return {
    Score: `${object.Score}/${max_score}`,
    Feedback: object.Feedback,
    Transcription: object.Transcription,
    Reasoning: object.Reasoning,
  };
}
