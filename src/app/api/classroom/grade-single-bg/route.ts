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

    // Fetch LATEST data from DB to ensure we have all gc_file_ids from recent syncs
    const { data: latestSub, error: fetchErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submission.id)
      .single();

    if (fetchErr || !latestSub) {
      throw new Error(`Could not find latest submission record: ${fetchErr?.message}`);
    }
    currentSubmission = latestSub;

    // Mark as grading
    await supabase.from('submissions').update({ status: 'grading' }).eq('id', submission.id);

    // 1. Determine which files to download
    const gcFileIds: string[] = currentSubmission.gc_file_ids || [];
    if (gcFileIds.length === 0 && currentSubmission.file_url?.startsWith('drive:')) {
      gcFileIds.push(currentSubmission.file_url.replace('drive:', ''));
    }

    console.log(`Downloading ${gcFileIds.length} files from Drive...`);
    const uploadedUrls: string[] = [];

    for (const fileId of gcFileIds) {
      console.log(`Downloading file ${fileId}...`);
      const { buffer, mimeType, filename } = await downloadDriveFile(fileId, providerToken);

      const filePath = `${assignmentId}/${Date.now()}_${Math.random().toString(36).substring(7)}_${filename}`;
      const { error: uploadError } = await supabase.storage.from('submissions').upload(filePath, buffer, { contentType: mimeType });
      if (uploadError) throw new Error(`Failed to upload file ${filename}: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
      uploadedUrls.push(publicUrlData.publicUrl);
    }

    // 3. Update DB record with all files
    const finalPrimaryUrl = uploadedUrls[0] || currentSubmission.file_url;
    console.log(`Updating DB for ${currentSubmission.student_name}: file_url=${finalPrimaryUrl}, file_urls_count=${uploadedUrls.length}`);

    const { error: urlUpdateError } = await supabase.from('submissions').update({
      file_url: finalPrimaryUrl,
      file_urls: uploadedUrls
    }).eq('id', currentSubmission.id);

    if (urlUpdateError) throw new Error(`Failed to update submission URLs: ${urlUpdateError.message}`);

    // 4. Trigger grading API
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";

    const gradeRes = await fetch(`${protocol}://${host}/api/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: currentSubmission.id, sendEmail: false })
    });

    if (!gradeRes.ok) {
      const errData = await gradeRes.json();
      await supabase.from('submissions').update({ status: 'error', feedback: errData.error }).eq('id', currentSubmission.id);
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
