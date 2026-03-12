import { supabase } from '@/lib/supabase';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { RubricCriterion } from '@/types/submission';
import mammoth from 'mammoth';

// Shared types
export interface CategoryScore {
  category: string;
  earned: number;
  possible: number;
}

export interface SkillAssessment {
  level: string;
  dimension: string;
  skill: string;
  status: 'demonstrated' | 'not_demonstrated' | 'partial' | 'not_assessed';
}

export interface GradeResult {
  Score: string;
  Feedback: string;
  Transcription: string[];
  Reasoning: string[];
  CategoryScores?: CategoryScore[];
  SkillAssessments?: SkillAssessment[];
  estCost?: number;
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
  generated_key?: any;
  structured_rubric?: RubricCriterion[];
}

function calculateCost(usage: any, modelType: 'flash' | 'pro') {
  if (!usage) return 0;
  const inputTokens = usage.inputTokens || usage.promptTokens || 0;
  const outputTokens = usage.outputTokens || usage.completionTokens || 0;
  if (modelType === 'flash') {
    // gemini-3.1-flash-lite-preview pricing
    return (inputTokens / 1000000) * 0.25 + (outputTokens / 1000000) * 1.50;
  } else {
    // gemini-2.5-pro pricing
    return (inputTokens / 1000000) * 1.25 + (outputTokens / 1000000) * 10.0; 
  }
}

export async function fetchToBuffer(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch file at ${url}`);

  let mimeType = res.headers.get('content-type') || 'application/pdf';
  let buffer = Buffer.from(await res.arrayBuffer());

  if (mimeType.includes('officedocument.wordprocessingml.document') || mimeType.includes('docx') || url.toLowerCase().includes('.docx')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      buffer = Buffer.from(result.value);
      mimeType = 'text/plain';
    } catch (e) {
      console.error("Failed to parse docx with mammoth:", e);
    }
  }

  if (buffer.length === 0) {
    buffer = Buffer.from('[This file appears to be completely empty or contains no extractable text]');
    mimeType = 'text/plain';
  }

  return { buffer, mimeType };
}

async function runVisionAgent({
  title,
  studentFiles,
  activeExemplars,
  answerKeyInstructions,
}: {
  title: string;
  studentFiles: { buffer: Buffer; mimeType: string }[];
  activeExemplars: string[];
  answerKeyInstructions: string;
}) {
  const systemPrompt = `
  You are an expert, meticulous science teacher scanning an assignment titled: "${title}".
  
  YOUR ONLY DIRECTIVE:
  Extract text carefully and output structured JSON containing the Transcription.
  
  ${answerKeyInstructions}
  
  GRADING PROCESS - STEP 1: VISUAL EXTRACTION:
  Scan the document line-by-line. If an Exemplar Answer Key is provided, you MUST look at what the correct answer is first to establish context for what messy handwriting might say.
  - FOR EVERY QUESTION: State the question number.
  - TRANSCRIBE: State exactly what you see.
  - FOR MULTIPLE CHOICE: You MUST check every option individually.
  - IF THERE IS NO HANDWRITTEN MARK: You MUST explicitly state "Question X: BLANK". Warning: Do not mistake scanner artifacts or smudges for circles.
  
  CRITICAL ANTI-HALLUCINATION RULES:
  - Never guess what the student "meant" to circle. Only transcribe markings physically present.
  - Do not evaluate correctness. Only extract the literal text or markings.
  `;

  const studentFileParts = studentFiles.map(sf => ({
    type: 'file' as const,
    data: sf.buffer.toString('base64'),
    mediaType: sf.mimeType,
  }));

  const aiMessages: any[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Student Submission Attached for Transcription:' },
        ...studentFileParts,
      ]
    }
  ];

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
        { type: 'text', text: 'PERFECT ANSWER KEY EXEMPLAR Attached. Use this to establish context for reading handwriting.' },
        ...execFileParts,
      ]
    });
  }

  const { object, usage } = await generateObject({
    model: google('gemini-3.1-flash-lite-preview'),
    system: systemPrompt,
    messages: aiMessages,
    temperature: 0.1,
    schema: z.object({
      Transcription: z.array(z.string()).describe("A physical visual extraction step. For each question: 1) Identify question number. 2) If Exemplar exists, note the expected answer. 3) Search area for physical marks. 4) Use expected answer as context to decode messy handwriting. 5) For multiple choice, explicitly dismiss unmarked options before declaring one is circled. 6) If blank, state 'BLANK'. Do not hallucinate."),
    }),
  });

  return { Transcription: object.Transcription, estCost: calculateCost(usage, 'flash') };
}

async function runGradingAgent({
  transcription,
  assignment,
  frameworkInstructions,
  categoryInstructions,
  rubricTextBlock,
  answerKeyInstructions,
  studentExemplars,
  rubricFiles,
}: {
  transcription: string[];
  assignment: AssignmentData;
  frameworkInstructions: string;
  categoryInstructions: string;
  rubricTextBlock: string;
  answerKeyInstructions: string;
  studentExemplars: any[];
  rubricFiles: ({ buffer: Buffer; mimeType: string } | null)[];
}) {
  const systemPrompt = `
  You are an expert, meticulous science teacher grading an assignment titled: "${assignment.title}".
  The maximum possible score is: ${assignment.max_score}.

  YOUR PRIMARY DIRECTIVE:
  Grade the student's submission accurately based ONLY on the provided transcription, rubric, and/or exemplars. You are evaluating the logic and correctness of the transcribed text.
  
  ${frameworkInstructions}
  ${categoryInstructions}
  ${rubricTextBlock}
  ${answerKeyInstructions}
  
  SCORING BEHAVIOR: Grade strictly by the rubric with NO generosity bias. If work is missing, the score for that section is 0 — do not give partial credit for "effort" or "attempting." Only the rubric criteria determine the score.

  EVALUATION PROCESS:
  1. Review the Transcription provided.
  2. Compare the transcribed answers against the rubric and/or exemplar.
  3. Output step-by-step reasoning comparing the Transcription vs the Rubric/Exemplar, then mapping to a score. Quote the exact text the student wrote when evaluating their reasoning.

  CRITICAL ANTI-HALLUCINATION RULES:
  - If comparing to an Exemplar, do a direct matching: Student Answer vs Exemplar Answer.
  - ONLY evaluate the text passed in the Transcription. Do not assume the student wrote something that is not in the transcription.
  `;

  const aiMessages: any[] = [
    { role: 'user', content: 'TRANSCRIPTION OF STUDENT SUBMISSION:\n\n' + transcription.join('\n\n') }
  ];

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

  if (studentExemplars && studentExemplars.length > 0) {
    for (const ex of studentExemplars) {
      if (!ex.file_url) continue;
      try {
        const exFile = await fetchToBuffer(ex.file_url);
        let categoryCalibration = '';
        if (ex.category_scores && ex.category_scores.length > 0) {
          const lines = ex.category_scores.map(
            (cs: CategoryScore) => `  - ${cs.category}: ${cs.earned}/${cs.possible}`
          );
          categoryCalibration = `\nTEACHER'S PER-CATEGORY BREAKDOWN (apply these same scoring patterns):\n${lines.join('\n')}`;
        } else if (ex.skill_assessments && ex.skill_assessments.length > 0) {
          const lines = ex.skill_assessments.map(
            (sa: SkillAssessment) => `  - [${sa.level}] ${sa.dimension}: ${sa.skill} → ${sa.status}`
          );
          categoryCalibration = `\nTEACHER'S PER-SKILL ASSESSMENT (apply these same judgments):\n${lines.join('\n')}`;
        }

        aiMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: `TEACHER APPROVED STUDENT EXEMPLAR:\nThe following attached document is a past student submission that the teacher explicitly marked as a grading exemplar.\nThe teacher gave this submission a SCORE of: ${ex.score}\nThe teacher gave this submission FEEDBACK of: "${ex.feedback}"\n${categoryCalibration}\nCALIBRATION INSTRUCTIONS:\n1. Note which rubric categories the teacher was strict vs lenient on.\n2. Note the point deductions: what errors cost how many points?\n3. Apply these SAME deduction patterns and strictness levels.` },
            { type: 'file' as const, data: exFile.buffer.toString('base64'), mediaType: exFile.mimeType },
          ]
        });
      } catch (e) { console.error("Failed to load student exemplar", e); }
    }
  }

  const categorySchemaFields = assignment.grading_framework === 'marzano'
    ? {
      SkillAssessments: z.array(z.object({
        level: z.string().describe("Proficiency level from the scale: '2.0', '3.0', or '4.0'"),
        dimension: z.string().describe("NGSS dimension: 'SEP', 'DCI', or 'CCC'"),
        skill: z.string().describe("The specific skill text from the proficiency scale"),
        status: z.enum(['demonstrated', 'not_demonstrated', 'partial', 'not_assessed']).describe("Status indicator")
      })).describe("Per-skill assessment list."),
    }
    : {
      CategoryScores: z.array(z.object({
        category: z.string().describe("The rubric criterion name"),
        earned: z.number().describe("Points earned"),
        possible: z.number().describe("Max points"),
      })).describe("Per-rubric-category score breakdown."),
    };

  const { object, usage } = await generateObject({
    model: google('gemini-2.5-pro'),
    system: systemPrompt,
    messages: aiMessages,
    temperature: 0.0,
    schema: z.object({
      Reasoning: z.array(z.string()).describe("Step-by-step reasoning linking transcription to rubric to score"),
      Score: z.string().describe(`The numeric score out of ${assignment.max_score}`),
      ...categorySchemaFields,
    }),
  });

  return { Score: object.Score, Reasoning: object.Reasoning, CategoryScores: (object as any).CategoryScores, SkillAssessments: (object as any).SkillAssessments, estCost: calculateCost(usage, 'pro') };
}

async function runSocraticAgent({
  transcription, reasoning, score, assignment, socraticInstructions, analogiesInstructions,
}: {
  transcription: string[]; reasoning: string[]; score: string; assignment: AssignmentData; socraticInstructions: string; analogiesInstructions: string;
}) {
  const systemPrompt = `
  You are an expert, meticulous science teacher providing feedback on an assignment titled: "${assignment.title}".
  The student's raw score is: ${score} / ${assignment.max_score}.
  
  YOUR PRIMARY DIRECTIVE:
  Transform the technical grading reasoning into warm, constructive student-facing feedback.
  
  FEEDBACK BEHAVIOR: Your written feedback MUST be a detailed walkthrough for EACH question (or each part of the essay/response). Use clear plain-text headers like 'Question 1:' or 'Paragraph 1:'. If the student got the question correct, simply write "Correct!" and nothing else to save reading time.
  ${socraticInstructions}
  ${analogiesInstructions}
  
  CRITICAL RULES:
  - Base your feedback completely on the provided Transcription and Reasoning.
  - Do not hallucinate errors that were not identified in the Reasoning.
  - Do not change the score.
  `;

  const aiMessages: any[] = [{
    role: 'user', content: `TRANSCRIPTION OF STUDENT SUBMISSION:\n${transcription.join('\n\n')}\n\nTECHNICAL REASONING FROM GRADING AGENT:\n${reasoning.join('\n\n')}`
  }];

  const { object, usage } = await generateObject({
    model: google('gemini-3.1-flash-lite-preview'),
    system: systemPrompt,
    messages: aiMessages,
    temperature: 0.4,
    schema: z.object({
      Feedback: z.string().describe('Detailed walkthrough feedback sectioned by question. Instruct and nudge rather than telling the correct answer if socratic.'),
    }),
  });

  return { Feedback: object.Feedback, estCost: calculateCost(usage, 'flash') };
}

export async function gradeSubmission(
  fileUrls: string[], assignment: AssignmentData, studentEmail?: string, attemptNumber: number = 1
): Promise<GradeResult> {
  const { rubric, rubrics, max_score, grading_framework, exemplar_url, exemplar_urls, is_socratic, generated_key, structured_rubric } = assignment;

  const activeRubrics = rubrics && rubrics.length > 0 ? rubrics : [rubric];
  const activeExemplars = exemplar_urls && exemplar_urls.length > 0 ? exemplar_urls : (exemplar_url ? [exemplar_url] : []);
  const textRubrics = activeRubrics.filter(r => r && !r.startsWith('http'));
  const fileRubrics = activeRubrics.filter(r => r && r.startsWith('http'));
  const studentFiles = await Promise.all(fileUrls.map(fetchToBuffer));
  const rubricFiles = await Promise.all(fileRubrics.map(async (url) => {
    try { return await fetchToBuffer(url); } catch (e) { return null; }
  })).then(results => results.filter(r => r !== null));

  const { data: studentExemplars } = await supabase.from('submissions').select('*').eq('assignment_id', assignment.id).eq('is_exemplar', true);

  let studentInterests: string[] = [];
  if (studentEmail) {
    const { data: profile } = await supabase.from('student_profiles').select('interests').eq('user_id', studentEmail).single();
    if (profile?.interests) studentInterests = profile.interests;
  }

  let frameworkInstructions = "";
  if (grading_framework === 'marzano') {
    frameworkInstructions = `
    GRADING FRAMEWORK (Marzano 4.0 Proficiency Scale):
    VALID SCORES: 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0
    You MUST output one of these exact values. No other scores are allowed.
    `;
  }

  let categoryInstructions = '';
  if (grading_framework === 'marzano') {
    categoryInstructions = `
    SKILL ASSESSMENT: For each skill listed in the proficiency scale at levels 2.0, 3.0, and 4.0, report whether the student demonstrated it.
    `;
  } else {
    categoryInstructions = `
    PER-CATEGORY SCORING: break down your score by rubric criterion. Sum of earned must equal total Score.
    `;
  }

  let socraticInstructions = '';
  if (is_socratic) {
    let baseSocratic = `
  🚨 CRITICAL SOCRATIC TUTOR DIRECTIVE 🚨
  The teacher has enabled Socratic Tutor Mode. YOU MUST NEVER REVEAL THE CORRECT ANSWER DIRECTLY if the student got it wrong.
  Instead ask a guiding question, point out a logical flaw, or refer them back to a specific concept to help them realize their own mistake.`;

    if (attemptNumber === 1) baseSocratic += `\n  ATTEMPT 1: Give light nudges and ask a single guiding question per mistake.`;
    else if (attemptNumber === 2) baseSocratic += `\n  ATTEMPT 2: Give more direct hints and point out exactly where their reasoning failed.`;
    else if (attemptNumber >= 3) baseSocratic += `\n  ATTEMPT ${attemptNumber}: You may now walk them through the solution step-by-step.`;

    socraticInstructions = baseSocratic;
  } else {
    socraticInstructions = `If the student got the question wrong, you may explicitly reveal the correct answer and explain why it is correct.`;
  }

  let analogiesInstructions = '';
  if (studentInterests.length > 0) analogiesInstructions = `STUDENT INTERESTS: ${studentInterests.join(', ')}. Try to use ONE brief analogy related to these.`;

  let rubricTextBlock: string;
  if (structured_rubric && structured_rubric.length > 0) {
    const criteriaText = structured_rubric.map((c, i) => `  ${i + 1}. ${c.name} (${c.maxPoints} pts): ${c.description}`).join('\n');
    rubricTextBlock = `\n  RUBRIC: The following structured criteria must each be scored individually:\n${criteriaText}`;
  } else if (textRubrics.length > 0) {
    rubricTextBlock = `\n  RUBRIC (Max Score: ${max_score}):\n  ${textRubrics.join("\n\n---\n\n")}`;
  } else if (rubricFiles.length > 0) {
    rubricTextBlock = `\n  RUBRIC: See the attached rubric document(s). Max Score: ${max_score}.`;
  } else {
    rubricTextBlock = `\n  RUBRIC (Max Score: ${max_score}): Grade based on quality, completeness, and accuracy.`;
  }

  let answerKeyInstructions = '';
  if (generated_key) answerKeyInstructions = `\n  🚨 AUTOMATED ANSWER KEY DETECTED 🚨\n  Use this as the source of truth:\n${JSON.stringify(generated_key, null, 2)}`;

  // Pipeline
  console.log("1. Running Vision Agent...");
  const visionOutput = await runVisionAgent({ title: assignment.title, studentFiles, activeExemplars, answerKeyInstructions });

  console.log("2. Running Grading Agent...");
  const gradingOutput = await runGradingAgent({
    transcription: visionOutput.Transcription,
    assignment, frameworkInstructions, categoryInstructions, rubricTextBlock, answerKeyInstructions,
    studentExemplars: studentExemplars || [], rubricFiles
  });

  console.log("3. Running Socratic Agent...");
  const socraticOutput = await runSocraticAgent({
    transcription: visionOutput.Transcription, reasoning: gradingOutput.Reasoning, score: gradingOutput.Score,
    assignment, socraticInstructions, analogiesInstructions
  });

  const totalCost = visionOutput.estCost + gradingOutput.estCost + socraticOutput.estCost;
  return {
    Score: `${gradingOutput.Score}/${max_score}`,
    Feedback: socraticOutput.Feedback,
    Transcription: visionOutput.Transcription,
    Reasoning: gradingOutput.Reasoning,
    CategoryScores: gradingOutput.CategoryScores ?? undefined,
    SkillAssessments: gradingOutput.SkillAssessments ?? undefined,
    estCost: totalCost,
  };
}
