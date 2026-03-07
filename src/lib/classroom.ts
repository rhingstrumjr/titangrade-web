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
    const gcFileIds: string[] = [];
    if (sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
      sub.assignmentSubmission.attachments.forEach((a: any) => {
        if (a.driveFile) {
          gcFileIds.push(a.driveFile.id);
        }
      });
    }

    const driveFileId = gcFileIds[0] || "";

    const studentInfo = studentsMap[sub.userId] || { name: "Unknown Student", email: "" };

    return {
      assignment_id: assignmentId,
      student_name: studentInfo.name,
      student_email: studentInfo.email,
      status: "pending", // Default to pending so teacher can "Grade All"
      gc_submission_id: sub.id,
      file_url: driveFileId ? `drive:${driveFileId}` : "",
      gc_file_ids: gcFileIds,
    };
  });

  if (submissionsToUpsert.length === 0) return { count: 0 };

  // 4. Update or Insert submissions. 
  // We want to make sure existing submissions get their gc_file_ids refreshed 
  // if more files were added in Classroom.
  const { data: existingSubs } = await supabase
    .from('submissions')
    .select('id, gc_submission_id, gc_file_ids')
    .eq('assignment_id', assignmentId);

  const existingMap = new Map((existingSubs || []).map(s => [s.gc_submission_id, s]));

  const newsOnly = [];
  const updatesNeeded = [];

  for (const s of submissionsToUpsert) {
    const existing = existingMap.get(s.gc_submission_id);
    if (!existing) {
      newsOnly.push(s);
    } else {
      // Check if file list changed
      const oldIds = existing.gc_file_ids || [];
      const newIds = s.gc_file_ids || [];
      const changed = oldIds.length !== newIds.length || !newIds.every((id: string, i: number) => id === oldIds[i]);

      if (changed) {
        updatesNeeded.push(
          supabase.from('submissions')
            .update({ gc_file_ids: newIds, file_url: s.file_url }) // Refresh the "drive:" url too
            .eq('id', existing.id)
        );
      }
    }
  }

  if (newsOnly.length > 0) {
    const { error: insertErr } = await supabase.from('submissions').insert(newsOnly);
    if (insertErr) throw insertErr;
  }

  if (updatesNeeded.length > 0) {
    await Promise.all(updatesNeeded);
  }

  return { count: newsOnly.length, totalFetched: submissionsToUpsert.length, updatedCount: updatesNeeded.length };
}

/**
 * Downloads a file from Google Drive and returns it as a Buffer with its metadata.
 */
export async function downloadDriveFile(fileId: string, token: string) {
  // 1. Get file metadata to determine MIME type
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const err = await metaRes.json();
    console.error("Drive metadata error:", err);
    throw new Error(`Failed to get file metadata: ${JSON.stringify(err)}`);
  }
  const meta = await metaRes.json();

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  let outMimeType = meta.mimeType;

  // 2. Map Google Workspace formats to PDF export
  if (
    meta.mimeType === "application/vnd.google-apps.document" ||
    meta.mimeType === "application/vnd.google-apps.presentation" ||
    meta.mimeType === "application/vnd.google-apps.spreadsheet"
  ) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
    outMimeType = "application/pdf";
  }

  // 3. Download the actual file / exported file
  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!fileRes.ok) {
    const errorText = await fileRes.text();
    console.error(`Drive fetch failed for ${fileId}. Status: ${fileRes.status}, Body: ${errorText}`);
    throw new Error(`Google Drive API Error (${fileRes.status}): ${errorText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Ensure filename is safe for Content-Disposition header
  const safeName = (meta.name || 'document').replace(/[^a-zA-Z0-9.\-_ ()]/g, "_");
  // Ensure it has a pdf extension if we exported it
  const finalName = outMimeType === "application/pdf" && !safeName.toLowerCase().endsWith('.pdf')
    ? `${safeName}.pdf`
    : safeName;

  return {
    buffer,
    mimeType: outMimeType || "application/octet-stream",
    filename: finalName
  };
}
