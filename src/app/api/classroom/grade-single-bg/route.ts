import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { downloadDriveFile } from "@/lib/classroom";

export async function POST(req: NextRequest) {
  let currentSubmission: any = null;

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }
    const providerToken = authHeader.split(" ")[1];

    const body = await req.json();
    const { submission, assignmentId } = body;

    if (!submission || !assignmentId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    currentSubmission = submission;
    console.log(`Starting background grade for submission ${submission.id} (student: ${submission.student_name})`);

    // Mark as grading
    await supabase.from('submissions').update({ status: 'grading' }).eq('id', submission.id);

    const fileId = submission.file_url.replace('drive:', '');
    console.log(`Downloading file ${fileId} from Drive...`);

    // 1. Download file directly via our lib (no internal fetch)
    const { buffer, mimeType, filename } = await downloadDriveFile(fileId, providerToken);
    console.log(`Download complete: ${filename} (${mimeType}), size: ${buffer.length} bytes`);

    // 2. Upload to Supabase Storage
    const filePath = `${assignmentId}/${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
    const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, buffer, { contentType: mimeType });
    if (uploadError) throw new Error("Failed to upload to storage: " + uploadError.message);

    const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
    const finalUrl = publicUrlData.publicUrl;

    // 3. Update DB record mapped to this file
    await supabase.from('submissions').update({ file_url: finalUrl, file_urls: [finalUrl] }).eq('id', submission.id);

    // 4. Trigger grading API
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const gradeRes = await fetch(`${protocol}://${host}/api/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: submission.id, sendEmail: false })
    });

    if (!gradeRes.ok) {
      const errData = await gradeRes.json();
      await supabase.from('submissions').update({ status: 'error', feedback: errData.error }).eq('id', submission.id);
      return NextResponse.json({ error: errData.error }, { status: 500 });
    }

    const gradedData = await gradeRes.json();

    return NextResponse.json({ success: true, score: gradedData.score });

  } catch (err: any) {
    console.error("Single BG Grading Error:", err);

    // Attempt to write the error state if we have the submission
    if (currentSubmission && currentSubmission.id) {
      try {
        await supabase.from('submissions').update({
          status: 'error',
          feedback: `Internal Grading Error: ${err.message}`
        }).eq('id', currentSubmission.id);
      } catch (dbErr) {
        console.error("Failed to mark submission as error in DB:", dbErr);
      }
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
