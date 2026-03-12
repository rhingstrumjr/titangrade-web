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
    const studentsData = await studentsRes.json();
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
        if (a.driveFile && !a.driveFile.title?.startsWith("TitanGrade Feedback:")) {
          gcFileIds.push(a.driveFile.id);
        }
      });
    }

    const driveFileId = gcFileIds[0] || "";

    const studentInfo = studentsMap[sub.userId] || { name: "Unknown Student", email: "" };

    const gcState = sub.state || "CREATED"; 
    const hasTurnedIn = gcState === "TURNED_IN" || gcState === "RETURNED";
    const hasFiles = gcFileIds.length > 0;
    const status = (hasTurnedIn && hasFiles) ? "pending" : "awaiting_submission";

    return {
      assignment_id: assignmentId,
      student_name: studentInfo.name,
      student_email: studentInfo.email,
      status,
      gc_submission_id: sub.id,
      gc_state: gcState,
      file_url: driveFileId ? `drive:${driveFileId}` : "",
      gc_file_ids: gcFileIds,
    };
  });

  if (submissionsToUpsert.length === 0) return { count: 0 };

  const { data: existingSubs } = await supabase
    .from('submissions')
    .select('id, gc_submission_id, gc_file_ids, gc_state, status')
    .eq('assignment_id', assignmentId);

  const existingMap = new Map((existingSubs || []).map(s => [s.gc_submission_id, s]));

  const newsOnly = [];
  const updatesNeeded = [];

  for (const s of submissionsToUpsert) {
    const existing = existingMap.get(s.gc_submission_id);
    if (!existing) {
      newsOnly.push(s);
    } else {
      const oldIds = existing.gc_file_ids || [];
      const newIds = s.gc_file_ids || [];
      const stateChanged = existing.gc_state !== s.gc_state;

      const needsFileRefresh = oldIds.length === 0 ||
        oldIds.length !== newIds.length ||
        !newIds.every((id: string, i: number) => id === oldIds[i]);

      if (needsFileRefresh) {
        updatesNeeded.push(
          supabase.from('submissions')
            .update({
              gc_file_ids: newIds,
              file_url: s.file_url,
              status: s.status,
              gc_state: s.gc_state,
              score: null,
              feedback: 'Sync detected new/changed file attachments. Ready for import.'
            })
            .eq('id', existing.id)
        );
      } else if (stateChanged) {
        const updatePayload: Record<string, any> = { gc_state: s.gc_state };
        if (existing.status === 'awaiting_submission' || existing.status === 'pending') {
          updatePayload.status = s.status;
        }
        updatesNeeded.push(
          supabase.from('submissions').update(updatePayload).eq('id', existing.id)
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
  const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaRes.ok) {
    const err = await metaRes.text();
    throw new Error(`Failed to get file metadata: ${err}`);
  }
  const meta = await metaRes.json();

  let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  let outMimeType = meta.mimeType;

  if (
    meta.mimeType === "application/vnd.google-apps.document" ||
    meta.mimeType === "application/vnd.google-apps.presentation" ||
    meta.mimeType === "application/vnd.google-apps.spreadsheet"
  ) {
    downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf&supportsAllDrives=true`;
    outMimeType = "application/pdf";
  }

  const fileRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!fileRes.ok) {
    const errorText = await fileRes.text();
    throw new Error(`Google Drive API Error (${fileRes.status}): ${errorText}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = (meta.name || 'document').replace(/[^a-zA-Z0-9.\-_ ()]/g, "_");
  const finalName = outMimeType === "application/pdf" && !safeName.toLowerCase().endsWith('.pdf')
    ? `${safeName}.pdf`
    : safeName;

  return {
    buffer,
    mimeType: outMimeType || "application/octet-stream",
    filename: finalName
  };
}

/**
 * Creates a Google Doc containing feedback, and attaches it to the student's submission.
 */
export async function attachFeedbackDocToSubmission(
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  studentName: string,
  feedbackText: string,
  token: string
) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. Create the Google Doc
  const docTitle = `TitanGrade Feedback: ${studentName}`;
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers,
    body: JSON.stringify({ title: docTitle }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("Failed to create Google Doc:", err);
    throw new Error(`Failed to create Google Doc for feedback: ${err}`);
  }
  
  const docData = await createRes.json();
  const documentId = docData.documentId;

  // 2. Insert text into the newly created Doc
  const fullText = `Feedback for ${studentName}\n\n${feedbackText}\n\nGenerated by TitanGrade.`;
  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: fullText,
            },
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    console.error("Failed to insert text into Google Doc:", err);
    throw new Error(`Failed to insert text into Google Doc: ${err}`);
  }

  // 3. Attach the Doc to the Google Classroom Submission
  const attachRes = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}:modifyAttachments`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        addAttachments: [{ driveFile: { id: documentId } }],
      }),
    }
  );

  if (!attachRes.ok) {
    const err = await attachRes.text();
    console.error("Failed to attach Doc to Classroom submission:", err);
    throw new Error(`Failed to attach Doc to Classroom submission: ${err}`);
  }

  return documentId;
}
