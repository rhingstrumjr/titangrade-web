import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
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
      throw new Error(`Failed to download file: ${fileRes.statusText}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", outMimeType || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${meta.name || 'document'}"`);

    return new NextResponse(arrayBuffer, { status: 200, headers });
  } catch (error: any) {
    console.error("Download error:", error);
    return NextResponse.json({ error: error.message || "Failed to download from Drive" }, { status: 500 });
  }
}
