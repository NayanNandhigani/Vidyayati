import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readUploadedFile } from "@/lib/storage";
import { requirePlatformModuleAccess } from "@/lib/permissions";

// Serves an uploaded SchoolDocument's bytes. Not under Next's public/
// folder — a link can't be guessed or shared outside the platform, since
// every request re-checks the caller's session and Schools access here.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformModuleAccess("Schools", "VIEW");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { id } = await params;
  const doc = await db.schoolDocument.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const bytes = await readUploadedFile(doc.storagePath).catch(() => null);
  if (!bytes) return NextResponse.json({ error: "File is missing from storage." }, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.name.replace(/["\r\n]/g, "_")}"`,
      "Content-Length": String(doc.sizeBytes),
      "Cache-Control": "private, no-store",
    },
  });
}
