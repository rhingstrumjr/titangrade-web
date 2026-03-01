import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

async function run() {
  try {
    const buffer = Buffer.from('test');
    await generateObject({
      model: google('gemini-1.5-flash'),
      system: 'Test',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Grade this assignment.' },
            {
              type: 'file',
              data: buffer.toString('base64'),
              mediaType: 'application/pdf',
            },
          ],
        },
      ],
      schema: z.object({ score: z.string() })
    });
    console.log("Success");
  } catch (err) {
    console.error(err);
  }
}
run();
