import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

// Local-disk storage under DATA/uploads. storagePath (e.g.
// "certificate-logos/<uuid>-name.png") is the one identifier every caller
// deals in, regardless of subdir — every call site across the app just
// passes it straight through.
const UPLOAD_ROOT = path.join(process.cwd(), "DATA", "uploads");

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

/** Writes a file under subdir/ and returns its storagePath (e.g. "subdir/<uuid>-name.ext") plus the generated file name. */
export async function saveUploadedFile(subdir: string, originalName: string, bytes: Buffer): Promise<{ storagePath: string; fileName: string }> {
  const fileName = `${randomUUID()}-${safeFileName(originalName)}`;
  // Always forward-slash, regardless of OS — storagePath gets embedded
  // directly into public URLs (see app/api/website-assets), and Windows'
  // path.join would otherwise return backslash-separated segments here.
  const storagePath = `${subdir}/${fileName}`;

  const dir = path.join(UPLOAD_ROOT, subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), bytes);

  return { storagePath, fileName };
}

export async function readUploadedFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(path.join(UPLOAD_ROOT, storagePath));
}

export async function deleteUploadedFile(storagePath: string): Promise<void> {
  await fs.unlink(path.join(UPLOAD_ROOT, storagePath)).catch(() => {});
}
