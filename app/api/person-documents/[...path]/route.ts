import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readUploadedFile } from "@/lib/storage";

// Serves student/staff document-repository files (ID proofs, certificates,
// medical records). Same shape as id-card-assets: authenticated session
// required, and it must belong to the exact school the path segment names
// — these are among the more sensitive uploads in the app.
const SAFE_PATH = /^documents\/([a-z0-9-]+)\/[A-Za-z0-9._-]+$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  bmp: "image/bmp",
};

function sniffContentType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const storagePath = segments.join("/");

  const match = SAFE_PATH.exec(storagePath);
  if (!match) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const session = await auth();
  if (!session?.user.schoolId || session.user.schoolId !== match[1]) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bytes = await readUploadedFile(storagePath).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? sniffContentType(bytes) ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
    },
  });
}
