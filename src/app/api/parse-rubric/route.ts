import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, file, mimeType, assignmentId } = body;

    if (!text && !file) {
      return NextResponse.json({ success: false, error: "Provide rubric text or a file." }, { status: 400 });
    }

    const systemPrompt = `You are an expert rubric parser. Given a rubric document (text or image/PDF), extract EVERY grading criterion into a structured list.
    
For each criterion, extract:
- name: The category/criterion name (e.g., "Scientific Question", "Hypothesis", "Data Collection")
- maxPoints: The maximum points for this criterion. If not explicitly stated, estimate based on context (default: 10)
- description: A clear description of what earns full credit for this criterion. Include specific requirements from the rubric.
- levels: If the rubric includes a breakdown by performance levels (e.g., Excellent/Proficient/Developing/Beginning or 4/3/2/1), extract EACH level with its label, point value, and description. 

RULES:
- Extract ALL criteria, even if they are listed as sub-sections
- If the rubric uses descriptive levels (Excellent/Good/Fair/Poor), include them as performance levels AND convert to point values
- If a Marzano proficiency scale is detected, YOU MUST extract each distinct skill, requirement, or "evidence statement" as a separate criterion.
- Even if multiple skills belong to the same level (2.0, 3.0, 4.0), they MUST be separate entries.
- CRITICAL: If a single rubric row or level contains multiple distinct requirements (e.g., separated by paragraphs, bullets, or "AND"), you MUST split them into MULTIPLE separate criteria objects. This is essential for granular assessment.
- NAMING CONVENTION: For the 'name' field, use EXACTLY the level number followed by a clear label (e.g., "3.0 - Target", "2.0 - Foundational").
- DESCRIPTION: The 'description' should be a concise, single-sentence requirement. Provide only the specific atomic requirement for that entry.
- This standardization allows the analytics engine to group identical skills across different submissions.
- Order criteria from lowest level to highest level (2.0 -> 3.0 -> 4.0).
- Performance levels (levels field) should still be included for each criterion if applicable, from highest to lowest.`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [];

    if (file) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Parse the following rubric document into structured criteria with performance levels:" },
          { type: "file", data: file, mediaType: mimeType || "application/pdf" },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Parse the following rubric text into structured criteria with performance levels:\n\n${text}`,
      });
    }

    const { object, usage } = await generateObject({
      model: google("gemini-3.1-flash-lite-preview"),
      system: systemPrompt,
      messages,
      temperature: 0.1,
      schema: z.object({
        criteria: z.array(
          z.object({
            name: z.string().describe("The criterion/category name"),
            maxPoints: z.number().describe("Maximum points for this criterion"),
            description: z.string().describe("What earns full credit for this criterion"),
            levels: z.array(
              z.object({
                label: z.string().describe("Performance level name, e.g. Excellent, Proficient"),
                points: z.number().describe("Points awarded at this level"),
                description: z.string().describe("What this performance level looks like"),
              })
            ).optional().describe("Performance level breakdown from highest to lowest"),
          })
        ).describe("All extracted rubric criteria"),
      }),
    });

    // Calculate cost
    let estCost = 0;
    if (usage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = usage as any;
      const inputTokens = u.inputTokens || u.promptTokens || 0;
      const outputTokens = u.outputTokens || u.completionTokens || 0;
      estCost = (inputTokens / 1000000) * 0.075 + (outputTokens / 1000000) * 0.3;
    }

    // Add cost to assignment if provided
    if (assignmentId && estCost > 0) {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("ai_cost")
        .eq("id", assignmentId)
        .single();

      const currentCost = assignment?.ai_cost || 0;
      await supabase
        .from("assignments")
        .update({ ai_cost: currentCost + estCost })
        .eq("id", assignmentId);
    }

    return NextResponse.json({
      success: true,
      criteria: object.criteria,
      estCost,
    });
  } catch (error) {
    console.error("Error parsing rubric:", error);
    return NextResponse.json(
      { success: false, error: "Failed to parse rubric with AI." },
      { status: 500 }
    );
  }
}
