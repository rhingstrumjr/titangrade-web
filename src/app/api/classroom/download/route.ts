import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getValidatedProviderToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
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
  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

  try {
    // 1. Get file metadata to determine MIME type
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaRes.ok) {
      const err = await metaRes.json();
      console.error("Drive metadata error:", err);
      throw new Error("Failed to get file metadata");
    }
    const meta = await metaRes.json();

    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    let outMimeType = meta.mimeType;

    // 2. Map Google Workspace formats to PDF export
    if (meta.mimeType === "application/vnd.google-apps.document" ||
      meta.mimeType === "application/vnd.google-apps.presentation" ||
      meta.mimeType === "application/vnd.google-apps.spreadsheet") {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
      outMimeType = "application/pdf";
    }

    // 3. Download the actual file / exported file
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!fileRes.ok) {
      const errorText = await fileRes.text();
      console.error(`Drive fetch failed for ${fileId}. URL: ${downloadUrl}, Status: ${fileRes.status}, Body: ${errorText}`);
      throw new Error(`Google Drive API Error (${fileRes.status}): ${errorText}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", outMimeType || "application/octet-stream");

    // Ensure filename is safe for Content-Disposition header
    const safeName = (meta.name || 'document').replace(/[^a-zA-Z0-9.\-_ ()]/g, "_");
    // Ensure it has a pdf extension if we exported it
    const finalName = outMimeType === "application/pdf" && !safeName.toLowerCase().endsWith('.pdf')
      ? `${safeName}.pdf`
      : safeName;

    headers.set("Content-Disposition", `attachment; filename="${finalName}"`);

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (error: any) {
    console.error("Download error:", error);
    return NextResponse.json({ error: error.message || "Failed to download from Drive" }, { status: 500 });
  }
}
