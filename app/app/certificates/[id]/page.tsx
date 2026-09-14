import { notFound } from "next/navigation";
import Link from "next/link";
import { loadCertificateForViewer } from "@/lib/certificates-server";
import { studentName } from "@/lib/format";
import CertificatePaper from "../CertificatePaper";

export default async function CertificateViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cert = await loadCertificateForViewer(id).catch(() => null);
  if (!cert) notFound();

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box", alignItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Link href="/app/certificates" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
              ← Back to Certificates
            </Link>
            <div className="disp" style={{ fontSize: 19, marginTop: 4 }}>
              {cert.template.label} · {studentName(cert.student)}
            </div>
          </div>
          <a
            href={`/api/certificates/${cert.id}/pdf`}
            style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            Download as PDF ↓
          </a>
        </div>

        <CertificatePaper schoolName={cert.school.name} title={cert.template.title} body={cert.renderedBody} issuedDate={cert.issuedDate} logoPath={cert.template.logoPath} />
      </div>
    </div>
  );
}
