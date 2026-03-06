import { supabase } from "./supabase";

/**
 * Fetches students and submissions from Google Classroom and upserts them into TitanGrade.
 */
export async function syncClassroomSubmissions(
  assignmentId: string,
  courseId: string,
  courseWorkId: string,
  token: string
) {
  const headers = { Authorization: `Bearer ${token}` };

  // 1. Fetch Students to map userId -> name, email
  const studentsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, { headers });
  let studentsMap: Record<string, { id: string; name: string; email: string }> = {};
  if (studentsRes.ok) {
    const studentsData = await studentsRes.ok ? await studentsRes.json() : { students: [] };
    if (studentsData.students) {
      studentsData.students.forEach((s: any) => {
        studentsMap[s.userId] = {
          id: s.userId,
          name: s.profile?.name?.fullName || "Unknown Student",
          email: s.profile?.emailAddress || ""
        };
      });
    }
  }

  // 2. Fetch Submissions
  const subsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, { headers });
  if (!subsRes.ok) {
    const err = await subsRes.json();
    console.error("Submissions fetch error:", err);
    throw new Error("Failed to fetch student submissions from Google Classroom");
  }
  const subsData = await subsRes.json();
  const gcSubmissions = subsData.studentSubmissions || [];

  // 3. Map to TitanGrade format
  const submissionsToUpsert = gcSubmissions.map((sub: any) => {
    let driveFileId = "";
    if (sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
      const attachment = sub.assignmentSubmission.attachments.find((a: any) => a.driveFile);
      if (attachment) {
        driveFileId = attachment.driveFile.id;
      }
    }

    const studentInfo = studentsMap[sub.userId] || { name: "Unknown Student", email: "" };

    return {
      assignment_id: assignmentId,
      student_name: studentInfo.name,
      student_email: studentInfo.email,
      status: "pending", // Default to pending so teacher can "Grade All"
      gc_submission_id: sub.id,
      file_url: driveFileId ? `drive:${driveFileId}` : "",
    };
  });

  if (submissionsToUpsert.length === 0) return { count: 0 };

  // 4. Upsert into DB. Use gc_submission_id + assignment_id as the conflict target if possible, 
  // but TitanGrade might not have a unique constraint on those yet.
  // For now, we'll do a manual check or just use 'onConflict' if the schema supports it.

  // Let's assume we want to avoid duplicates. We'll fetch existing gc_submission_ids for this assignment.
  const { data: existingSubs } = await supabase
    .from('submissions')
    .select('gc_submission_id')
    .eq('assignment_id', assignmentId);

  const existingIds = new Set((existingSubs || []).map(s => s.gc_submission_id));

  const newsOnly = submissionsToUpsert.filter((s: any) => !existingIds.has(s.gc_submission_id));

  if (newsOnly.length > 0) {
    const { error: insertErr } = await supabase.from('submissions').insert(newsOnly);
    if (insertErr) throw insertErr;
  }

  return { count: newsOnly.length, totalFetched: submissionsToUpsert.length };
}
