import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb } from "@/lib/tenant-db";
import { hasFeature } from "@/lib/feature-flags";
import GeneralForm from "./GeneralForm";
import AcademicYearsPanel from "./AcademicYearsPanel";
import IdCardPanel from "./IdCardPanel";
import GradingPanel from "./GradingPanel";
import CertificateBuilderPanel from "./CertificateBuilderPanel";
import CompliancePanel from "./CompliancePanel";

const BASE_PANELS = [
  { key: "general", label: "General" },
  { key: "years", label: "Academic Years" },
  { key: "website", label: "Website Builder" },
  { key: "idcards", label: "ID Card Templates" },
  { key: "grading", label: "Grading" },
  { key: "certificates", label: "Document Editor" },
];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ panel?: string }> }) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") redirect("/app/dashboard");

  const showCompliance = await hasFeature(session!.user.schoolId, "compliance.udise");
  const PANELS = showCompliance ? [...BASE_PANELS, { key: "compliance", label: "UDISE+ & Compliance" }] : BASE_PANELS;

  const params = await searchParams;
  const panel = PANELS.some((p) => p.key === params.panel) ? params.panel! : "general";
  const sdb = await getScopedDb();

  const school = await db.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! } });

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Settings
      </div>

      <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ width: 196, flex: "none", padding: 10, display: "flex", flexDirection: "column", gap: 2, height: "fit-content" }}>
          {PANELS.map((p) => (
            <Link
              key={p.key}
              href={`/app/settings?panel=${p.key}`}
              style={{ padding: "9px 12px", borderRadius: 7, fontSize: 13, fontWeight: panel === p.key ? 700 : 500, background: panel === p.key ? "var(--marigold-tint)" : "transparent", color: panel === p.key ? "var(--marigold-deep)" : "var(--ink)", textDecoration: "none" }}
            >
              {p.label}
            </Link>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", margin: "6px 0" }} />
          <Link href="/app/settings/audit-log" style={{ padding: "9px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, color: "var(--ink)", textDecoration: "none" }}>
            Audit Log
          </Link>
        </div>

        {panel === "general" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <GeneralForm school={{ name: school.name, city: school.city, state: school.state, admissionNoPrefix: school.admissionNoPrefix }} />
          </div>
        )}

        {panel === "years" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <YearsPanelData sdb={sdb} />
          </div>
        )}

        {panel === "website" && (
          <div className="card" style={{ flex: 1, padding: 26, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)" }}>
              Website Builder
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
              Your school's public website is edited directly on the live page itself — drag, resize, and edit
              text, images, and buttons right where they appear, no separate form to keep in sync.
            </div>
            <Link
              href={`/site/${school.code}`}
              target="_blank"
              style={{ alignSelf: "flex-start", marginTop: 6, background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              Edit your website ↗
            </Link>
          </div>
        )}

        {panel === "idcards" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <IdCardPanelData sdb={sdb} />
          </div>
        )}

        {panel === "grading" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <GradingPanelData sdb={sdb} />
          </div>
        )}

        {panel === "certificates" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <CertificatesPanelData sdb={sdb} />
          </div>
        )}

        {panel === "compliance" && (
          <div className="card" style={{ flex: 1, padding: 26, overflowY: "auto" }}>
            <CompliancePanelData sdb={sdb} school={school} />
          </div>
        )}
      </div>
    </div>
  );
}

async function CompliancePanelData({ sdb, school }: { sdb: Awaited<ReturnType<typeof getScopedDb>>; school: { udiseCode: string | null; affiliationBoard: string | null; affiliationNumber: string | null } }) {
  const documents = await sdb.schoolComplianceDocument.findMany({ orderBy: { expiryDate: "asc" } });
  return (
    <CompliancePanel
      udiseCode={school.udiseCode}
      affiliationBoard={school.affiliationBoard}
      affiliationNumber={school.affiliationNumber}
      documents={documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        documentNo: d.documentNo,
        issuedDate: d.issuedDate?.toISOString() ?? null,
        expiryDate: d.expiryDate?.toISOString() ?? null,
        filePath: d.filePath,
      }))}
    />
  );
}

async function CertificatesPanelData({ sdb }: { sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const templates = await sdb.certificateTemplate.findMany({ include: { _count: { select: { issued: true } } }, orderBy: { label: "asc" } });
  return (
    <CertificateBuilderPanel
      templates={templates.map((t) => ({
        id: t.id,
        type: t.type,
        label: t.label,
        title: t.title,
        bodyText: t.bodyText,
        logoPath: t.logoPath,
        issuedCount: t._count.issued,
      }))}
    />
  );
}

async function YearsPanelData({ sdb }: { sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const years = await sdb.academicYear.findMany({ orderBy: { startDate: "asc" } });
  return <AcademicYearsPanel years={years.map((y) => ({ id: y.id, label: y.label, startDate: y.startDate.toISOString(), endDate: y.endDate.toISOString(), isCurrent: y.isCurrent }))} />;
}

async function IdCardPanelData({ sdb }: { sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const templates = await sdb.idCardTemplate.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <IdCardPanel
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        audience: t.audience,
        orientation: t.orientation,
        isActive: t.isActive,
        backgroundColor: t.backgroundColor,
      }))}
    />
  );
}

async function GradingPanelData({ sdb }: { sdb: Awaited<ReturnType<typeof getScopedDb>> }) {
  const scales = await sdb.gradeScale.findMany({ orderBy: { name: "asc" }, include: { bands: true } });
  return (
    <GradingPanel
      scales={scales.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
        bands: s.bands.map((b) => ({ id: b.id, label: b.label, minPercent: Number(b.minPercent), maxPercent: Number(b.maxPercent), remark: b.remark })),
      }))}
    />
  );
}
