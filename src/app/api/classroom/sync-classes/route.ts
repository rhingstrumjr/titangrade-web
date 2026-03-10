import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  const providerToken = authHeader.replace("Bearer ", "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // 1. Fetch all courses from Google Classroom
    const coursesRes = await fetch(
      "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=100",
      { headers: { Authorization: `Bearer ${providerToken}` } }
    );

    if (!coursesRes.ok) {
      const errText = await coursesRes.text();
      return NextResponse.json({ error: "Failed to fetch courses from Google Classroom", details: errText }, { status: 500 });
    }

    const coursesData = await coursesRes.json();
    const gcCourses = coursesData.courses || [];

    if (gcCourses.length === 0) {
      return NextResponse.json({ synced: 0, message: "No active Google Classroom courses found." });
    }

    // 2. Fetch existing TitanGrade classes for this teacher
    const { data: existingClasses } = await supabase
      .from("classes")
      .select("id, name, gc_course_id")
      .eq("teacher_id", user.id);

    const existingGcIds = new Set(
      (existingClasses || []).filter((c) => c.gc_course_id).map((c) => c.gc_course_id)
    );

    // 3. Create new TitanGrade classes for courses that don't exist yet
    const newClasses = gcCourses
      .filter((course: any) => !existingGcIds.has(course.id))
      .map((course: any) => ({
        name: course.name,
        gc_course_id: course.id,
        teacher_id: user.id,
      }));

    let created = 0;
    if (newClasses.length > 0) {
      const { data, error } = await supabase.from("classes").insert(newClasses).select();
      if (error) {
        return NextResponse.json({ error: "Failed to create classes", details: error.message }, { status: 500 });
      }
      created = data?.length || 0;
    }

    // 4. Return summary
    return NextResponse.json({
      synced: created,
      total_gc_courses: gcCourses.length,
      already_linked: existingGcIds.size,
      message: created > 0
        ? `Created ${created} new class(es) from Google Classroom.`
        : "All Google Classroom courses are already synced.",
    });
  } catch (err: any) {
    console.error("[sync-classes] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
