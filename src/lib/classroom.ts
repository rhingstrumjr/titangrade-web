/**
 * Fetches students and submissions from Google Classroom and upserts them into TitanGrade.
 */
export async function syncClassroomSubmissions(
  assignmentId: string,
  courseId: string,
  courseWorkId: string,
  token: string,
  supabase: any
) {
  const headers = { Authorization: `Bearer ${token}` };

  // 1. Fetch Students
  const studentsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/students`, { headers });
  let studentsList: any[] = [];
  if (studentsRes.ok) {
    const studentsData = await studentsRes.json();
    studentsList = studentsData.students || [];
  }

  // 2. Fetch Submissions
  const subsRes = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, { headers });
  let gcSubmissions: any[] = [];
  if (subsRes.ok) {
    const subsData = await subsRes.json();
    gcSubmissions = subsData.studentSubmissions || [];
  } else {
    console.error("Submissions fetch error or none immediately available.");
  }

  const subsByUserId = new Map(gcSubmissions.map(s => [s.userId, s]));

  // 3. Map to TitanGrade format based on ROSTER
  const submissionsToUpsert = studentsList.map((student: any) => {
    const sub = subsByUserId.get(student.userId);
    const gcFileIds: string[] = [];
    if (sub && sub.assignmentSubmission && sub.assignmentSubmission.attachments) {
      sub.assignmentSubmission.attachments.forEach((a: any) => {
        if (a.driveFile && !a.driveFile.title?.startsWith("TitanGrade Feedback:")) {
          gcFileIds.push(a.driveFile.id);
        }
      });
    }

    const driveFileId = gcFileIds[0] || "";
    const email = student.profile?.emailAddress || "";
    const name = student.profile?.name?.fullName || "Unknown Student";

    const gcState = sub ? (sub.state || "CREATED") : "CREATED"; 
    const hasTurnedIn = gcState === "TURNED_IN" || gcState === "RETURNED";
    const hasFiles = gcFileIds.length > 0;
    const status = (hasTurnedIn && hasFiles) ? "pending" : "awaiting_submission";

    return {
      assignment_id: assignmentId,
      student_name: name,
      student_email: email,
      status,
      gc_submission_id: sub ? sub.id : null,
      gc_state: gcState,
      file_url: driveFileId ? `drive:${driveFileId}` : "",
      gc_file_ids: gcFileIds,
    };
  });

  if (submissionsToUpsert.length === 0) return { count: 0, totalFetched: 0, updatedCount: 0 };

  const { data: existingSubs } = await supabase
    .from('submissions')
    .select('id, gc_submission_id, gc_file_ids, gc_state, status, student_email, score, feedback')
    .eq('assignment_id', assignmentId);

  // Match by email primarily to avoid duplicates when gc_submission_id changes from null
  const existingMap = new Map<string, any>((existingSubs || []).map((s: any) => [s.student_email, s]));

  const newsOnly = [];
  const updatesNeeded = [];

  for (const s of submissionsToUpsert) {
    const existing = existingMap.get(s.student_email);
    if (!existing) {
      newsOnly.push(s);
    } else {
      const oldIds = existing.gc_file_ids || [];
      const newIds = s.gc_file_ids || [];
      const stateChanged = existing.gc_state !== s.gc_state;
      const gcSubIdChanged = existing.gc_submission_id !== s.gc_submission_id;

      const needsFileRefresh = oldIds.length === 0 ||
        oldIds.length !== newIds.length ||
        !newIds.every((id: string, i: number) => id === oldIds[i]);

      if (needsFileRefresh || gcSubIdChanged) {
        updatesNeeded.push(
          supabase.from('submissions')
            .update({
              gc_file_ids: newIds,
              file_url: s.file_url,
              status: s.status,
              gc_state: s.gc_state,
              gc_submission_id: s.gc_submission_id,
              score: existing.score,
              feedback: needsFileRefresh ? 'Sync detected new/changed file attachments. Ready for import.' : existing.feedback
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
