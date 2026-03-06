import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    // Mark as grading
    await supabase.from('submissions').update({ status: 'grading' }).eq('id', submission.id);

    const fileId = submission.file_url.replace('drive:', '');

    // 1. Download file via our API
    // We use the absolute URL of our own host so the fetch works server-side
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const dlRes = await fetch(`${protocol}://${host}/api/classroom/download?fileId=${fileId}`, {
      headers: { Authorization: `Bearer ${providerToken}` }
    });

    if (!dlRes.ok) throw new Error("Failed to download file from Google Drive");

    const arrayBuffer = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = dlRes.headers.get('Content-Type') || 'application/pdf';

    const contentDisposition = dlRes.headers.get('Content-Disposition');
    let filename = `submission_${submission.student_name.replace(/\s+/g, '_')}.pdf`;
    if (contentDisposition && contentDisposition.includes('filename="')) {
      filename = contentDisposition.split('filename="')[1].split('"')[0];
    }

    // 2. Upload to Supabase Storage
    const filePath = `${assignmentId}/${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
    const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, buffer, { contentType });
    if (uploadError) throw new Error("Failed to upload to storage: " + uploadError.message);

    const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
    const finalUrl = publicUrlData.publicUrl;

    // 3. Update DB record mapped to this file
    await supabase.from('submissions').update({ file_url: finalUrl, file_urls: [finalUrl] }).eq('id', submission.id);

    // 4. Trigger grading API
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
