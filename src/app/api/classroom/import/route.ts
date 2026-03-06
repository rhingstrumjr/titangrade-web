import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  let token = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  // Fallback to cookie if frontend did not provide it
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get("provider_token")?.value;
  }

  if (!token) {
    return NextResponse.json({ error: "Missing or invalid authorization token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { courseId, courseWorkId } = body;

    if (!courseId || !courseWorkId) {
      return NextResponse.json({ error: "courseId and courseWorkId are required" }, { status: 400 });
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 1. Fetch Assignment Metadata
    const assignmentRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}`, { headers });
    if (!assignmentRes.ok) {
      const err = await assignmentRes.json();
      console.error("Assignment fetch error:", err);
      throw new Error("Failed to fetch assignment metadata");
    }
    const assignmentData = await assignmentRes.json();

    // 2. Fetch Students to map userId -> name, email
    const studentsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, { headers });
    let studentsMap: Record<string, { id: string; name: string; email: string }> = {};
    if (studentsRes.ok) {
      const studentsData = await studentsRes.json();
      if (studentsData.students) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        studentsData.students.forEach((s: any) => {
          studentsMap[s.userId] = {
            id: s.userId,
            name: s.profile?.name?.fullName || "Unknown Student",
            email: s.profile?.emailAddress || ""
          };
        });
      }
    }

    // 3. Fetch Submissions
    const subsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, { headers });
    if (!subsRes.ok) {
      const err = await subsRes.json();
      console.error("Submissions fetch error:", err);
      throw new Error("Failed to fetch student submissions");
    }
    const subsData = await subsRes.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submissions = (subsData.studentSubmissions || []).map((sub: any) => {
      let driveFile = null;
      if (sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const attachment = sub.assignmentSubmission.attachments.find((a: any) => a.driveFile);
        if (attachment) {
          driveFile = {
            id: attachment.driveFile.id,
            title: attachment.driveFile.title,
            alternateLink: attachment.driveFile.alternateLink
          };
        }
      }

      const studentInfo = studentsMap[sub.userId] || { name: "Unknown Student", email: "" };

      return {
        id: sub.id, // Google Classroom submission ID
        userId: sub.userId,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        state: sub.state, // e.g., TURNED_IN, CREATED, RETURNED
        driveFile
      };
    });

    return NextResponse.json({
      assignment: {
        title: assignmentData.title,
        description: assignmentData.description,
        maxPoints: assignmentData.maxPoints,
      },
      submissions
    });
  } catch (error: any) {
    console.error("Error importing from Classroom:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
