import { NextResponse } from "next/server";
import { readUploadedFile } from "@/lib/storage";

// Serves a school's public website logo/gallery images. Deliberately
// unauthenticated — the whole point of these files is that the public
// site (no session) can display them — so the path itself is validated
// strictly (must be "website/<schoolId>/<safe-filename>") to rule out
// path traversal or serving anything outside that subdir.
const SAFE_PATH = /^website\/[a-z0-9-]+\/[A-Za-z0-9._-]+$/;

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

// Extension-based lookup covers the overwhelming majority of uploads, but
// a school logo is very often an SVG or an oddly-named export with no
// (or a wrong) extension — those were silently falling back to
// application/octet-stream, which a browser's <img> tag refuses to
// render at all (shows as a broken image, not just the wrong colors).
// Sniffing the first few bytes is a last-resort backstop for exactly
// that case.
function sniffContentType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (bytes.length >= 6 && bytes.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  // SVG is XML text, not a fixed binary signature — look for the tag
  // itself in the first slice of the file (skips any leading XML prolog).
  if (bytes.subarray(0, 512).toString("utf-8").includes("<svg")) return "image/svg+xml";
  return null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const storagePath = segments.join("/");

  if (!SAFE_PATH.test(storagePath)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bytes = await readUploadedFile(storagePath).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? sniffContentType(bytes) ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
