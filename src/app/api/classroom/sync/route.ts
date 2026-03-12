import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { syncClassroomSubmissions } from "@/lib/classroom";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let token = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // Fallback to cookie
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("provider_token")?.value;
  }

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401 });
  }

  try {
    const { assignmentId } = await req.json();

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    // 1. Fetch assignment to get GC details
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('gc_course_id, gc_coursework_id')
      .eq('id', assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    if (!assignment.gc_course_id || !assignment.gc_coursework_id) {
      return NextResponse.json({ error: "This assignment is not linked to Google Classroom" }, { status: 400 });
    }

    // 2. Perform Sync
    const result = await syncClassroomSubmissions(
      assignmentId,
      assignment.gc_course_id,
      assignment.gc_coursework_id,
      token,
      supabase
    );

    return NextResponse.json({
      success: true,
      newSubmissionsCount: result.count,
      updatedCount: result.updatedCount,
      totalFetched: result.totalFetched
    });

  } catch (err: any) {
    console.error("Sync API Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
