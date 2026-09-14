"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { renderCertificateBody } from "@/lib/certificates";
import { issueCertificate } from "./actions";
import CertificatePaper from "./CertificatePaper";

type Template = { id: string; type: string; label: string; title: string; body: string; logoPath: string | null; issuedCount: number };
type Student = { id: string; name: string; admissionNo: string; className: string };

export default function GeneratePanel({
  templates,
  students,
  schoolName,
  yearLabel,
  initialTemplateId,
  recentIssued,
}: {
  templates: Template[];
  students: Student[];
  schoolName: string;
  yearLabel: string;
  initialTemplateId: string;
  recentIssued: { id: string; studentName: string; templateLabel: string; issuedDate: string }[];
}) {
  // Template selection is driven entirely by the parent Server Component's
  // ?template= URL param (the left sidebar's Links do the navigating) — not
  // local state. It was `useState(initialTemplateId)` before, which only
  // consumes its initial value on first mount: clicking a different
  // template card re-renders this component with a new initialTemplateId
  // prop, but React ignores that for state already initialized, so the
  // panel stayed stuck on whichever template happened to be selected the
  // very first time it mounted. Reading the prop directly fixes that.
  const templateId = initialTemplateId;
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [issuedId, setIssuedId] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const student = students.find((s) => s.id === studentId);

  const preview = useMemo(() => {
    if (!template || !student) return "";
    return renderCertificateBody(template.body, { name: student.name, admissionNo: student.admissionNo, school: schoolName, class: student.className, year: yearLabel });
  }, [template, student, schoolName, yearLabel]);

  function issue() {
    if (!template || !student) return;
    startTransition(async () => {
      const res = await issueCertificate(template.id, student.id);
      setIssuedId(res.id);
    });
  }

  return (
    <div className="card" style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Generate certificate</div>
        <span className="pill" style={{ background: "var(--marigold-tint)", color: "var(--marigold-deep)" }}>
          {template?.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <select
          className="in"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setIssuedId(null);
          }}
          style={{ flex: 1.3 }}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.className}
            </option>
          ))}
        </select>
        <div className="in mono" style={{ flex: 1, background: "var(--paper)" }}>
          {yearLabel}
        </div>
      </div>

      {template && <CertificatePaper schoolName={schoolName} title={template.title} body={preview} issuedDate={new Date()} logoPath={template.logoPath} />}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={issue}
          disabled={pending || !student}
          style={{ flex: 1, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Issuing…" : "Issue certificate"}
        </button>
        {issuedId && (
          <Link
            href={`/app/certificates/${issuedId}`}
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--good)", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Issued ✓ View certificate →
          </Link>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div style={{ fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9 }}>Recently generated</div>
        {recentIssued.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>None yet.</div>}
        {recentIssued.map((r) => (
          <Link
            key={r.id}
            href={`/app/certificates/${r.id}`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit" }}
          >
            <span>
              <span style={{ fontWeight: 600 }}>{r.studentName}</span>
              <span style={{ color: "var(--muted)" }}> · {r.templateLabel}</span>
            </span>
            <span className="mono" style={{ color: "var(--faint)" }}>
              {new Date(r.issuedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
