"use client";

import { useState, useTransition } from "react";
import { updateExam, approveExam, rejectExam } from "./actions";

type ExamSubjectRow = { id: string; subjectId: string; name: string; maxMarks: number };
type Subject = { id: string; name: string };

const APPROVAL_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Pending approval" },
  APPROVED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Approved" },
  REJECTED: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Rejected" },
};

export default function ScheduleExamPanel({
  examId,
  examName,
  startDate,
  endDate,
  classLabel,
  approvalStatus,
  isSchoolAdmin,
  canEdit,
  examSubjects,
  allSubjects,
}: {
  examId: string;
  examName: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  classLabel: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED";
  isSchoolAdmin: boolean;
  canEdit: boolean;
  examSubjects: ExamSubjectRow[];
  allSubjects: Subject[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(examName);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [rows, setRows] = useState<{ examSubjectId?: string; subjectId: string; name: string; maxMarks: number }[]>(
    examSubjects.map((es) => ({ examSubjectId: es.id, subjectId: es.subjectId, name: es.name, maxMarks: es.maxMarks }))
  );
  const [addSubjectId, setAddSubjectId] = useState("");

  const usedSubjectIds = new Set(rows.map((r) => r.subjectId));
  const availableToAdd = allSubjects.filter((s) => !usedSubjectIds.has(s.id));

  function addSubject() {
    if (!addSubjectId) return;
    const subject = allSubjects.find((s) => s.id === addSubjectId);
    if (!subject) return;
    setRows((prev) => [...prev, { subjectId: subject.id, name: subject.name, maxMarks: 100 }]);
    setAddSubjectId("");
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateExam(examId, {
          name,
          startDate: start,
          endDate: end,
          subjects: rows.map((r) => ({ examSubjectId: r.examSubjectId, subjectId: r.subjectId, maxMarks: r.maxMarks })),
        });
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function approve() {
    startTransition(() => approveExam(examId));
  }
  function reject() {
    startTransition(() => rejectExam(examId));
  }

  const style = APPROVAL_STYLE[approvalStatus];

  if (editing) {
    return (
      <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Edit exam · Class {classLabel}</div>
        <label className="field">
          Exam name
          <input className="in" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label className="field">
            Start date
            <input className="in" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            End date
            <input className="in" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <div className="field">
          Subjects &amp; max marks
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {rows.map((r, i) => (
              <div key={r.examSubjectId ?? r.subjectId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                <input
                  className="in"
                  type="number"
                  value={r.maxMarks}
                  onChange={(e) => setRows((prev) => prev.map((row, j) => (j === i ? { ...row, maxMarks: Number(e.target.value) } : row)))}
                  style={{ width: 70 }}
                />
              </div>
            ))}
          </div>
          {availableToAdd.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <select className="in" value={addSubjectId} onChange={(e) => setAddSubjectId(e.target.value)} style={{ flex: 1 }}>
                <option value="">+ Add another subject…</option>
                {availableToAdd.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={addSubject} disabled={!addSubjectId} style={{ fontSize: 12.5, fontWeight: 700, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, padding: "0 14px" }}>
                Add
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 6 }}>Subjects already scheduled can't be removed here — marks may already be entered against them.</div>
        </div>

        {error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={save} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <span onClick={() => setEditing(false)} style={{ fontSize: 13.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer", padding: "9px 4px" }}>
            Cancel
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{examName}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Class {classLabel} · {new Date(startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – {new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pill" style={{ background: style.bg, color: style.fg }}>
            {style.label}
          </span>
          {canEdit && (
            <span onClick={() => setEditing(true)} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
              Edit
            </span>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Subjects</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {examSubjects.map((es) => (
            <span key={es.id} className="pill" style={{ background: "var(--paper)", color: "var(--ink2)", border: "1px solid var(--line)" }}>
              {es.name} <span className="mono" style={{ color: "var(--faint)" }}>· {es.maxMarks}</span>
            </span>
          ))}
        </div>
      </div>

      {isSchoolAdmin && approvalStatus === "PENDING" && (
        <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <button onClick={approve} disabled={pending} style={{ flex: 1, background: "var(--good)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
            Approve exam
          </button>
          <button onClick={reject} disabled={pending} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--critical)", color: "var(--critical)", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
            Reject exam
          </button>
        </div>
      )}
      {approvalStatus === "PENDING" && !isSchoolAdmin && (
        <div style={{ fontSize: 12, color: "var(--warn)", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          Waiting on a School Admin to approve this exam before it's successfully scheduled.
        </div>
      )}
    </div>
  );
}
