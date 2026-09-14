import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { loadCertificateForViewer } from "@/lib/certificates-server";
import { CertificateDocument } from "@/lib/certificate-pdf";
import { studentName } from "@/lib/format";
import { readUploadedFile } from "@/lib/storage";

const EXT_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let cert;
  try {
    cert = await loadCertificateForViewer(id);
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!cert) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // react-pdf's <Image> needs a data URI or raw buffer, not a URL it can
  // fetch itself — read the logo straight off disk via the same storage
  // helper the upload path already uses. SVG isn't rasterizable by
  // react-pdf's Image component, so skip embedding it rather than
  // passing through a format it can't render (the on-screen preview
  // still shows it fine, since a browser <img> handles SVG natively).
  let logoDataUri: string | null = null;
  if (cert.template.logoPath) {
    const ext = cert.template.logoPath.split(".").pop()?.toLowerCase() ?? "";
    const mime = EXT_MIME[ext];
    if (mime) {
      const bytes = await readUploadedFile(cert.template.logoPath).catch(() => null);
      if (bytes) logoDataUri = `data:${mime};base64,${bytes.toString("base64")}`;
    }
  }

  const buffer = await renderToBuffer(
    CertificateDocument({ schoolName: cert.school.name, title: cert.template.title, body: cert.renderedBody, issuedDate: cert.issuedDate, logoDataUri })
  );

  const fileName = `${cert.template.label.replace(/[^a-zA-Z0-9]+/g, "-")}-${studentName(cert.student).replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
