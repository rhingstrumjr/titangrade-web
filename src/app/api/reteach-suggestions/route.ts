import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { assignmentId, assignmentTitle, troubleSpots, gradingFramework } = body;

    if (!troubleSpots || troubleSpots.length === 0) {
      return NextResponse.json(
        { success: false, error: "No trouble spots provided." },
        { status: 400 }
      );
    }

    const troubleSpotText = troubleSpots
      .map(
        (ts: { criterion: string; avgScore: string; pctStruggling: number }, i: number) =>
          `${i + 1}. "${ts.criterion}" — Average score: ${ts.avgScore}, ${ts.pctStruggling}% of students struggled`
      )
      .join("\n");

    const frameworkContext = gradingFramework === "marzano"
      ? "This class uses the Marzano proficiency scale (0.0–4.0). Struggling means scoring below 2.0 on a skill."
      : "This class uses standard percentage grading. Struggling means scoring below 60%.";

    const systemPrompt = `You are an expert instructional coach and curriculum specialist. A teacher has just graded an assignment titled "${assignmentTitle}" and wants to know how to help students who struggled.

${frameworkContext}

Here are the areas where students had the most difficulty:

${troubleSpotText}

Provide a concise, actionable RETEACH PLAN with:
1. **Quick Diagnosis** — In 1-2 sentences, summarize the pattern of misconceptions
2. **Bell-Ringer Activity** — A 5-minute warm-up activity for the next class to address the biggest gap
3. **Targeted Mini-Lesson** — A 10-15 minute focused lesson plan for the weakest area
4. **Practice Activity** — A hands-on or collaborative activity students can do to reinforce the concept
5. **Formative Check** — A quick way to verify students have closed the gap before moving on

Keep it practical and specific to the content area. Use markdown formatting with headers.`;

    const { text, usage } = await generateText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      prompt: `Generate a reteach plan for the assignment "${assignmentTitle}" based on the trouble spots listed in the system prompt.`,
      temperature: 0.7,
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

    // Add cost to assignment
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
      plan: text,
      estCost,
    });
  } catch (error) {
    console.error("Error generating reteach suggestions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate reteach plan." },
      { status: 500 }
    );
  }
}
