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

    const messages: any[] = [];

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || 'application/pdf';

      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Parse the attached NGSS Evidence Statement or standards document. Extract each performance expectation as a standard, then break it down into Marzano-style learning targets at levels 2.0 (foundational), 3.0 (target mastery), and 4.0 (advanced application). Identify the NGSS dimension (SEP, DCI, or CCC) for each standard.',
          },
          {
            type: 'file',
            data: buffer.toString('base64'),
            mediaType: mimeType,
          },
        ],
      });
    } else if (textContent) {
      messages.push({
        role: 'user',
        content: `Parse the following standards text. Extract each performance expectation as a standard, then break it down into Marzano-style learning targets at levels 2.0 (foundational), 3.0 (target mastery), and 4.0 (advanced application). Identify the NGSS dimension (SEP, DCI, or CCC) for each standard.\n\n${textContent}`,
      });
    }

    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite-preview'),
      system: `You are an expert NGSS curriculum designer. Your job is to parse science standards documents and break them into assessable Marzano-style learning targets.

RULES:
1. Each standard should have a code (e.g., HS-PS1-8, MS-LS1-2) and a description.
2. Each standard must have exactly 3 learning targets:
   - Level 2.0: Foundational vocabulary, recall, and basic recognition tasks.
   - Level 3.0: The target-level mastery — applying, analyzing, or explaining the core concept.
   - Level 4.0: In-depth inference, novel application, or cross-cutting connections beyond the standard.
3. The dimension should be one of: SEP (Science & Engineering Practice), DCI (Disciplinary Core Idea), or CCC (Crosscutting Concept).
4. Write targets as measurable, student-facing "I can" statements or clear action descriptions.`,
      messages,
      temperature: 0.2,
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
                description: z.string().describe('Specific, measurable learning target description'),
              })
            ).describe('Exactly 3 targets per standard: one at each level'),
          })
        ).describe('Array of parsed standards with their learning targets'),
      }),
    });

    return NextResponse.json({ success: true, standards: object.standards });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Parse Standard API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
