import { NextRequest, NextResponse } from 'next/server';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 60; // Allow more time for generation

// Structure we want to extract from a blank worksheet
const answerKeySchema = z.object({
  questions: z.array(z.object({
    questionNumber: z.string().describe("The number or label of the question (e.g., '1', '2a', 'Q3')"),
    questionText: z.string().describe("The text of the question extracted from the document"),
    questionType: z.enum(["multiple_choice", "short_answer", "essay", "fill_in_blank"]).describe("The type of question"),
    suggestedAnswer: z.string().describe("The generated correct answer. For multiple choice, just the letter. For short answer, a model response."),
    keyConcepts: z.array(z.string()).optional().describe("Key concepts or vocabulary words that would earn points in this answer.")
  }))
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString('base64');
    const mimeType = file.type;

    // Use Gemini 2.5 Flash to generate the answer key
    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: answerKeySchema,
      system: `
      You are an expert teacher creating an answer key for a blank worksheet, quiz, or test.
      Analyze the provided document image/PDF.
      Identify every question, extract its text, determine its type, and write a correct 'suggestedAnswer'.
      For open-ended questions, include 'keyConcepts' that are essential for full credit.
      Be precise, accurate, and comprehensive. Do not hallucinate questions that are not on the page.
      `,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Generate an answer key for this assignment.' },
            { type: 'file', data: fileBase64, mediaType: mimeType }
          ]
        }
      ]
    });

    // Log Token Usage if available
    let estCost = 0;
    if (result.usage) {
      const usage = result.usage as any;
      const inputTokens = usage.promptTokens || 0;
      const outputTokens = usage.completionTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      // Rough cost: $0.075/1M input, $0.30/1M output for flash
      estCost = (inputTokens / 1000000) * 0.075 + (outputTokens / 1000000) * 0.3;

      try {
        await fetch('http://localhost:5001/api/log_usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: 'TitanGrade',
            tokens_used: totalTokens,
            cost: estCost,
            model: 'gemini-2.5-flash',
            context: 'Automated Answer Key Generation'
          })
        });
      } catch (e) {
        console.error("Failed to log token usage:", e);
      }
    }

    return NextResponse.json({
      success: true,
      answerKey: result.object,
      estCost
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error generating answer key:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
