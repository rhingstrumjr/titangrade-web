import { NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const textContent = formData.get('text') as string | null;

    if (!file && !textContent) {
      return NextResponse.json({ error: 'No file or text provided' }, { status: 400 });
    }

    const promptText = `Parse the attached NGSS Evidence Statement or standards document. Extract each performance expectation as a standard, then break it down into Marzano-style learning targets at levels 2.0 (foundational), 3.0 (target mastery), and 4.0 (advanced application).

CRITICAL: For EACH level, produce MULTIPLE granular, bite-sized targets. Do NOT combine multiple concepts into a single target. Each target should be a single, specific, measurable skill.

For example, instead of:
  "I can identify the components of an atom (protons, neutrons, electrons) and describe how elements are organized in the periodic table based on proton number and valence electrons."

Break it into:
  - "Identify components of an atom (protons, neutrons, and electrons)"
  - "Explain the pattern of proton number on the periodic table"
  - "Explain the pattern of valence electrons on the periodic table"

Each level should have 2-6 separate granular targets. Identify the NGSS dimension (SEP, DCI, or CCC) for each standard.`;

    const messages: any[] = [];

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || 'application/pdf';

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'file', data: buffer.toString('base64'), mediaType: mimeType },
        ],
      });
    } else if (textContent) {
      messages.push({
        role: 'user',
        content: `${promptText}\n\n${textContent}`,
      });
    }

    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite-preview'),
      system: `You are an expert NGSS curriculum designer. Your job is to parse science standards documents and break them into granular, assessable Marzano-style learning targets.

RULES:
1. Each standard should have a code (e.g., HS-PS1-8, MS-LS1-2) and a description.
2. Each standard must have learning targets at 3 levels:
   - Level 2.0: Foundational vocabulary, recall, basic recognition — the prerequisite knowledge.
   - Level 3.0: Target-level mastery — applying, analyzing, or explaining the core concept.
   - Level 4.0: In-depth inference, novel application, or cross-cutting connections beyond the standard.
3. CRITICAL: Each level should have MULTIPLE targets (2-6). Each target must be a single, specific, measurable skill or concept. NEVER combine multiple ideas into one target. If a concept has multiple parts, split them into separate targets.
4. The dimension should be one of: SEP (Science & Engineering Practice), DCI (Disciplinary Core Idea), or CCC (Crosscutting Concept).
5. Write targets as clear action descriptions starting with a verb (e.g., "Identify...", "Explain...", "Compare...", "Design...").
6. Think about prerequisite skills that a teacher would need to teach — include these as 2.0 targets even if not explicitly stated in the standard.`,
      messages,
      temperature: 0.3,
      schema: z.object({
        standards: z.array(
          z.object({
            code: z.string().describe('The NGSS standard code, e.g., HS-PS1-8'),
            description: z.string().describe('Full text of the performance expectation'),
            dimension: z
              .enum(['SEP', 'DCI', 'CCC'])
              .describe('Primary NGSS dimension')
              .optional(),
            learning_targets: z.array(
              z.object({
                level: z.enum(['2.0', '3.0', '4.0']).describe('Marzano proficiency level'),
                description: z.string().describe('A single, specific, measurable learning target — one concept only'),
              })
            ).describe('Multiple granular targets per level (2-6 per level, not one combined description)'),
          })
        ).describe('Array of parsed standards with their granular learning targets'),
      }),
    });

    return NextResponse.json({ success: true, standards: object.standards });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Parse Standard API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
