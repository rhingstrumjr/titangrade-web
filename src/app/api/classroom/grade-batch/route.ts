import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }
    const providerToken = authHeader.split(" ")[1];

    const body = await req.json();
    const { submissions, assignmentId } = body;

    if (!submissions || !Array.isArray(submissions) || !assignmentId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Set all to grading in one batch
    await supabase
      .from('submissions')
      .update({ status: 'grading' })
      .in('id', submissions.map((s: any) => s.id));

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Kick off all grading tasks concurrently in the background.
    // We DO NOT await these fetches. This allows the Vercel Lambda
    // for this request to return immediately, while spawning new requests
    // to lambda functions that have their full execution timeouts.
    submissions.forEach((submission: any) => {
      fetch(`${baseUrl}/api/classroom/grade-single-bg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerToken}`
        },
        body: JSON.stringify({ submission, assignmentId })
      }).catch(err => {
        console.error("Failed to kick off background grade:", err);
      });
    });

    return NextResponse.json({ success: true, message: "Grading started in background" }, { status: 202 });

  } catch (err: any) {
    console.error("Batch Grading Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
