import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readUploadedFile } from "@/lib/storage";

// Serves ID Card Template assets: a template's own logo/decorative
// images, and per-person photos (Student.photoPath / StaffProfile.photoPath).
// Unlike website-assets/certificate-assets (deliberately public logos),
// a student's photo is tied to a real named minor — this route requires
// a session belonging to the exact same school as the path's schoolId
// segment, matching the tenant-isolation rule in lib/tenant-db.ts.
const SAFE_PATH = /^idcards\/([a-z0-9-]+)\/[A-Za-z0-9._-]+$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
};

function sniffContentType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  if (bytes.subarray(0, 512).toString("utf-8").includes("<svg")) return "image/svg+xml";
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
    },
  });
}
