import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { DEFAULT_TEMPLATE_BODY } from "@/lib/certificates";
import { studentName } from "@/lib/format";
import { Prisma, CertificateType } from "@prisma/client";
import GeneratePanel from "./GeneratePanel";

const TYPES: Exclude<CertificateType, "CUSTOM">[] = ["BONAFIDE", "TRANSFER", "CHARACTER", "ACHIEVEMENT"];

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentCertificatesView />;
  }

  const accessLevel = await requireModuleAccess("Certificates", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const params = await searchParams;

  // Every school needs these four standard certificate types — provision any
  // that are missing with sensible default label/title/body on first visit.
  // A School Admin can rename/rewrite any of them afterward, or add
  // entirely custom ones, from Settings → Certificate Builder.
  const existing = await sdb.certificateTemplate.findMany();
  const missing = TYPES.filter((t) => !existing.some((e) => e.type === t));
  if (missing.length > 0 && canEdit) {
    await sdb.certificateTemplate.createMany({
      data: missing.map((type) =>
        scopedCreateData<Prisma.CertificateTemplateUncheckedCreateInput>({
          type,
          label: DEFAULT_TEMPLATE_BODY[type].label,
          title: DEFAULT_TEMPLATE_BODY[type].title,
          bodyText: DEFAULT_TEMPLATE_BODY[type].body,
        })
      ),
    });
  }

  const [templates, students, currentYear, school] = await Promise.all([
    sdb.certificateTemplate.findMany({ include: { _count: { select: { issued: true } } } }),
    sdb.student.findMany({ where: { status: "ACTIVE" }, include: { class: true }, orderBy: [{ firstName: "asc" }, { surname: "asc" }] }),
    sdb.academicYear.findFirst({ where: { isCurrent: true } }),
    db.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! } }),
  ]);

  const templateData = templates.map((t) => ({
    id: t.id,
    type: t.type,
    label: t.label,
    title: t.title,
    body: t.bodyText,
    logoPath: t.logoPath,
    issuedCount: t._count.issued,
  }));

  const selectedId = params.template ?? templateData[0]?.id;
  const totalIssuedThisYear = templateData.reduce((s, t) => s + t.issuedCount, 0);

  const recent = await sdb.certificateIssued.findMany({
    include: { student: true, template: true },
    orderBy: { issuedDate: "desc" },
    take: 10,
  });

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Certificate generator
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {canEdit && (
            <Link href="/app/settings?panel=certificates" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--marigold-deep)", textDecoration: "none" }}>
              Certificate Builder →
            </Link>
          )}
          <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {totalIssuedThisYear} issued this year
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "298px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{templateData.length} templates</div>
          {templateData.map((t) => {
            const isSelected = t.id === selectedId;
            return (
              <Link
                key={t.id}
                href={`/app/certificates?template=${t.id}`}
                className="card"
                style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 14px", textDecoration: "none", color: "inherit", border: isSelected ? "1.5px solid var(--marigold)" : "1px solid var(--line)", boxShadow: isSelected ? "0 0 0 3px var(--marigold-tint)" : undefined }}
              >
                <div style={{ width: 52, height: 70, background: "#FFFDF9", border: "1px solid var(--marigold-tint)", borderRadius: 6, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{t.label}</div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--faint)", marginTop: 5 }}>
                    {t.issuedCount} issued this year
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {templateData.length > 0 && students.length > 0 ? (
          <GeneratePanel
            templates={templateData}
            students={students.map((s) => ({ id: s.id, name: studentName(s), admissionNo: s.admissionNo, className: `Class ${s.class.grade}, Section ${s.class.section}` }))}
            schoolName={school.name}
            yearLabel={currentYear?.label ?? "—"}
            initialTemplateId={selectedId ?? ""}
            recentIssued={recent.map((r) => ({ id: r.id, studentName: studentName(r.student), templateLabel: r.template.label, issuedDate: r.issuedDate.toISOString() }))}
          />
        ) : (
          <div className="card" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            {students.length === 0 ? "No students enrolled yet." : "No templates available."}
          </div>
        )}
      </div>
    </div>
  );
}

async function ParentCertificatesView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: { studentLinks: { include: { student: { include: { certificatesIssued: { include: { template: true }, orderBy: { issuedDate: "desc" } } } } } } },
  });
  const students = parent?.studentLinks.map((l) => l.student) ?? [];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Certificates
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>{studentName(s)}</div>
          {s.certificatesIssued.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No certificates issued yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.certificatesIssued.map((c) => (
                <Link
                  key={c.id}
                  href={`/app/certificates/${c.id}`}
                  style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--paper)", borderRadius: 8, fontSize: 12.5, textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ fontWeight: 600 }}>{c.template.label}</span>
                  <span className="mono" style={{ color: "var(--muted)" }}>
                    {c.issuedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
