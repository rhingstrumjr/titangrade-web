import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { syncClassroomSubmissions } from "@/lib/classroom";
import { getValidatedProviderToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let token = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // Fallback to cookie if frontend did not provide it
  if (!token) {
    token = await getValidatedProviderToken();
  }

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { assignmentId, courseId, state = 'PUBLISHED' } = body;

    if (!assignmentId || !courseId) {
      return NextResponse.json({ error: "assignmentId and courseId are required" }, { status: 400 });
    }

    // 1. Fetch Assignment from DB
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (assignErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // 2. Prepare Google Classroom CourseWork data
    const courseWorkData = {
      title: assignment.title,
      description: assignment.description || 'Graded with TitanGrade',
      maxPoints: assignment.max_score,
      workType: 'ASSIGNMENT',
      state: state, // 'DRAFT' or 'PUBLISHED'
    };

    // 3. Send to Google Classroom API
    const gcRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(courseWorkData)
    });

    if (!gcRes.ok) {
      const err = await gcRes.json();
      console.error("Failed to create coursework in GC:", err);
      return NextResponse.json({ error: "Failed to create assignment in Google Classroom" }, { status: 500 });
    }

    const gcCourseWork = await gcRes.json();

    // 4. Update the assignment in DB
    const { error: updateErr } = await supabase
      .from('assignments')
      .update({
        gc_course_id: courseId,
        gc_coursework_id: gcCourseWork.id
      })
      .eq('id', assignmentId);

    if (updateErr) {
      console.error("Failed to update assignment with GC IDs:", updateErr);
      return NextResponse.json({ error: "Created in GC but failed to save link in DB" }, { status: 500 });
    }

    // 5. AUTO-SYNC: Immediately pull students roster as pending submissions
    try {
      await syncClassroomSubmissions(assignmentId, courseId, gcCourseWork.id, token, supabase);
    } catch (syncErr) {
      console.error("Auto-sync failed during publication:", syncErr);
      // We don't fail the whole request because the assignment was already created and linked
    }

    return NextResponse.json({ success: true, courseWorkId: gcCourseWork.id });

  } catch (error: any) {
    console.error("Error creating coursework:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
