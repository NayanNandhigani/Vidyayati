"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { avatarColorFor } from "@/lib/academic";
import { initials } from "@/lib/format";
import { advanceToApplication, admitEnquiry } from "./actions";

type Enquiry = {
  id: string;
  applicantName: string;
  parentContact: string;
  classApplied: string;
  stage: "ENQUIRY" | "APPLICATION" | "ADMITTED";
  approvalStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
};

const APPROVAL_STYLE: Record<string, { bg: string; fg: string }> = {
  NONE: { bg: "var(--line)", fg: "var(--muted)" },
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  APPROVED: { bg: "var(--good-tint)", fg: "var(--good)" },
  REJECTED: { bg: "var(--critical-tint)", fg: "var(--critical)" },
};

// Once an enquiry is admitted it becomes a real Student record (see Students)
// — there's nothing further to do with it on this board, so it isn't given
// its own column here. The enquiry row itself is kept (stage: "ADMITTED")
// for the pipeline's own history/conversion-rate stats above, it just isn't
// rendered as a card once it reaches that stage.
const COLS = [
  { stage: "ENQUIRY" as const, label: "Enquiries", bg: "var(--marigold-tint)", fg: "var(--marigold-deep)" },
  { stage: "APPLICATION" as const, label: "Applications", bg: "var(--teal-tint)", fg: "var(--teal)" },
];

export default function AdmissionsBoard({ enquiries, classes, canEdit, showDetailedForm }: { enquiries: Enquiry[]; classes: { id: string; grade: string; section: string }[]; canEdit: boolean; showDetailedForm: boolean }) {
  const [admitting, setAdmitting] = useState<string | null>(null);
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const total = enquiries.length;
  const applications = enquiries.filter((e) => e.stage === "APPLICATION" || e.stage === "ADMITTED").length;
  const admitted = enquiries.filter((e) => e.stage === "ADMITTED").length;
  const conversion = total ? Math.round((admitted / total) * 100) : 0;

  function move(id: string) {
    startTransition(async () => {
      await advanceToApplication(id);
    });
  }

  function confirmAdmit(id: string) {
    if (!classId) return;
    startTransition(async () => {
      await admitEnquiry(id, classId);
      setAdmitting(null);
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
        <div>
          <span style={{ color: "var(--muted)" }}>Enquiries</span> <span className="mono" style={{ fontWeight: 700 }}>{total}</span>
        </div>
        <div style={{ color: "var(--faint)" }}>→</div>
        <div>
          <span style={{ color: "var(--muted)" }}>Applications</span> <span className="mono" style={{ fontWeight: 700 }}>{applications}</span>
        </div>
        <div style={{ color: "var(--faint)" }}>→</div>
        <div>
          <span style={{ color: "var(--muted)" }}>Admitted</span> <span className="mono" style={{ fontWeight: 700 }}>{admitted}</span>
        </div>
        <div style={{ marginLeft: "auto", color: "var(--muted)" }}>
          Conversion rate <span className="mono" style={{ color: "var(--marigold-deep)", fontWeight: 700 }}>{conversion}%</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {COLS.map((col) => {
          const items = enquiries.filter((e) => e.stage === col.stage);
          return (
            <div key={col.stage} style={{ background: col.bg, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 0, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{col.label}</span>
                <span className="mono" style={{ fontSize: 12, color: col.fg, fontWeight: 700 }}>
                  {items.length}
                </span>
              </div>
              {items.map((e) => (
                <div key={e.id} style={{ position: "relative", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{e.applicantName}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Applying for {e.classApplied}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                      {e.parentContact}
                    </span>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: avatarColorFor(e.id), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#fff" }}>
                      {initials(e.applicantName)}
                    </div>
                  </div>

                  {showDetailedForm && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      {e.approvalStatus !== "NONE" && (
                        <span className="pill" style={{ background: APPROVAL_STYLE[e.approvalStatus].bg, color: APPROVAL_STYLE[e.approvalStatus].fg, fontSize: 10 }}>
                          {e.approvalStatus}
                        </span>
                      )}
                      {col.stage !== "ENQUIRY" && (
                        <Link href={`/app/admissions/${e.id}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", textDecoration: "none", marginLeft: "auto" }}>
                          View application →
                        </Link>
                      )}
                    </div>
                  )}

                  {canEdit && col.stage === "ENQUIRY" && (
                    <button onClick={() => move(e.id)} disabled={pending} style={moveBtnStyle}>
                      Move →
                    </button>
                  )}

                  {canEdit && !showDetailedForm && col.stage === "APPLICATION" && admitting !== e.id && (
                    <button onClick={() => setAdmitting(e.id)} disabled={pending} style={moveBtnStyle}>
                      Move →
                    </button>
                  )}

                  {canEdit && !showDetailedForm && col.stage === "APPLICATION" && admitting === e.id && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                      <select value={classId} onChange={(ev) => setClassId(ev.target.value)} style={{ fontSize: 11.5, padding: 4 }}>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.grade}-{c.section}
                          </option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => confirmAdmit(e.id)} disabled={pending} style={{ flex: 1, fontSize: 11, fontWeight: 700, background: "var(--good)", color: "#fff", border: "none", borderRadius: 6, padding: "5px 0", cursor: "pointer" }}>
                          Admit
                        </button>
                        <button onClick={() => setAdmitting(null)} style={{ flex: 1, fontSize: 11, fontWeight: 600, background: "var(--line)", border: "none", borderRadius: 6, padding: "5px 0", cursor: "pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)" }}>Nothing here.</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

const moveBtnStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  border: "none",
  background: "var(--marigold)",
  color: "#fff",
  fontSize: 10.5,
  fontWeight: 700,
  padding: "4px 9px",
  borderRadius: 100,
  cursor: "pointer",
};
