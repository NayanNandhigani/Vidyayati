"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { initials, daysUntil } from "@/lib/format";
import { avatarColorFor, subjectStyleFor } from "@/lib/academic";
import type { SubmissionStatus } from "@prisma/client";
import { cycleSubmissionStatus, setSubmissionScore, remindPending } from "./actions";
import { uploadHomeworkAttachment } from "./depth-actions";

type Submission = { id: string; studentId: string; student: { name: string }; status: SubmissionStatus; score: number | null };
type Assignment = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  subject: { name: string };
  class: { grade: string; section: string };
  staff: { user: { name: string } };
  submissions: Submission[];
  attachmentPath: string | null;
};

const subjectStyle = subjectStyleFor;

const STATUS_STYLE: Record<SubmissionStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  SUBMITTED: { bg: "var(--good-tint)", fg: "var(--good)" },
  LATE: { bg: "var(--critical-tint)", fg: "var(--critical)" },
};

function bucketFor(a: Assignment): "Assigned" | "Due this week" | "Submitted" | "Graded" {
  const total = a.submissions.length;
  const graded = a.submissions.filter((s) => s.score !== null).length;
  const submitted = a.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "LATE").length;
  if (total > 0 && graded === total) return "Graded";
  if (total > 0 && submitted === total) return "Submitted";
  if (daysUntil(new Date(a.dueDate)) <= 7) return "Due this week";
  return "Assigned";
}

export default function HomeworkBoard({ assignments, initialSelectedId, canEdit, showAttachments }: { assignments: Assignment[]; initialSelectedId: string | null; canEdit: boolean; showAttachments: boolean }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? assignments[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [reminded, setReminded] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"status" | "date">("status");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickAttachment() {
    fileRef.current?.click();
  }
  function onAttachmentChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(() => uploadHomeworkAttachment(selected.id, formData));
  }

  const columns = useMemo(() => {
    const buckets: Record<string, Assignment[]> = { Assigned: [], "Due this week": [], Submitted: [], Graded: [] };
    for (const a of assignments) buckets[bucketFor(a)].push(a);
    return buckets;
  }, [assignments]);

  // "View past homework as per each date" — the same assignments grouped
  // by due date instead of status, newest date first, for browsing what
  // was assigned on/around a given day rather than by submission state.
  const dateGroups = useMemo(() => {
    const groups = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const key = new Date(a.dueDate).toISOString().slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [assignments]);

  const selected = assignments.find((a) => a.id === selectedId) ?? null;

  function toggleStatus(sub: Submission) {
    if (!canEdit) return;
    startTransition(async () => {
      await cycleSubmissionStatus(sub.id);
    });
  }

  function updateScore(subId: string, value: string) {
    if (!canEdit || value === "") return;
    const n = Math.max(0, Math.min(10, Number(value)));
    if (Number.isNaN(n)) return;
    startTransition(async () => {
      await setSubmissionScore(subId, n);
    });
  }

  function remind() {
    if (!selected) return;
    startTransition(async () => {
      const res = await remindPending(selected.id);
      setReminded(res.remindedCount);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <span
          onClick={() => setViewMode("status")}
          className="pill"
          style={{ cursor: "pointer", background: viewMode === "status" ? "var(--marigold)" : "var(--card)", color: viewMode === "status" ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
        >
          By status
        </span>
        <span
          onClick={() => setViewMode("date")}
          className="pill"
          style={{ cursor: "pointer", background: viewMode === "date" ? "var(--marigold)" : "var(--card)", color: viewMode === "date" ? "#fff" : "var(--ink2)", border: "1px solid var(--line)" }}
        >
          By date
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr) 300px", gap: 13, flex: 1, minHeight: 0 }}>
      {viewMode === "date" ? (
        <div style={{ gridColumn: "1 / 5", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingRight: 4 }}>
          {dateGroups.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No homework assigned yet.</div>}
          {dateGroups.map(([dateKey, items]) => (
            <div key={dateKey}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>
                {new Date(dateKey).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
                <span className="mono" style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 600, color: "var(--faint)", background: "var(--line)", borderRadius: 100, padding: "1px 7px" }}>
                  {items.length}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
                {items.map((a) => {
                  const total = a.submissions.length;
                  const submitted = a.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "LATE").length;
                  const style = subjectStyle(a.subject.name);
                  const isSelected = a.id === selectedId;
                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      style={{
                        background: "var(--card)",
                        border: isSelected ? "1px solid var(--marigold)" : "1px solid var(--line)",
                        boxShadow: isSelected ? "0 0 0 2px var(--marigold-tint), 0 0 0 1px var(--marigold) inset" : undefined,
                        borderRadius: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: style.bg, color: style.fg }}>{a.subject.name}</span>
                        <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                          {a.class.grade}-{a.class.section}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{a.title}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                        {submitted}/{total} submitted
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        (["Assigned", "Due this week", "Submitted", "Graded"] as const).map((col) => (
        <div key={col} style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px 10px" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{col}</span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--faint)", background: "var(--line)", borderRadius: 100, padding: "1px 7px" }}>
              {columns[col].length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, overflowY: "auto" }}>
            {columns[col].map((a) => {
              const total = a.submissions.length;
              const submitted = a.submissions.filter((s) => s.status === "SUBMITTED" || s.status === "LATE").length;
              const pct = total ? (submitted / total) * 100 : 0;
              const style = subjectStyle(a.subject.name);
              const isSelected = a.id === selectedId;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{
                    background: "var(--card)",
                    border: isSelected ? "1px solid var(--marigold)" : "1px solid var(--line)",
                    boxShadow: isSelected ? "0 0 0 2px var(--marigold-tint), 0 0 0 1px var(--marigold) inset" : undefined,
                    borderRadius: 10,
                    padding: "12px 13px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: style.bg, color: style.fg }}>{a.subject.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                      {a.class.grade}-{a.class.section}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{a.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: avatarColorFor(a.staff.user.name), fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flex: "none" }}>
                      {initials(a.staff.user.name)}
                    </div>
                    <span>{a.staff.user.name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                      Due {new Date(a.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                      {submitted}/{total}
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: style.fg, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            {columns[col].length === 0 && <div style={{ fontSize: 12, color: "var(--faint)", padding: "8px 4px" }}>Nothing here.</div>}
          </div>
        </div>
        ))
      )}

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {selected ? (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, ...subjectStyle(selected.subject.name) }}>{selected.subject.name}</span>
                <span className="pill" style={{ background: "var(--line)", color: "var(--muted)" }}>
                  {bucketFor(selected)}
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{selected.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                Class {selected.class.grade}-{selected.class.section} · {selected.staff.user.name}
              </div>
            </div>

            <div className="field">
              Due date
              <div className="in mono">{new Date(selected.dueDate).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}</div>
            </div>
            {selected.description && (
              <div className="field">
                Description
                <div className="in" style={{ lineHeight: 1.5 }}>
                  {selected.description}
                </div>
              </div>
            )}
            {showAttachments && (
              <div className="field">
                Attachment
                <div className="in" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {selected.attachmentPath ? (
                    <a href={`/api/person-documents/${selected.attachmentPath}`} target="_blank" rel="noreferrer" style={{ color: "var(--marigold-deep)", fontWeight: 600, fontSize: 12.5 }}>
                      View attachment
                    </a>
                  ) : (
                    <span style={{ color: "var(--faint)", fontSize: 12.5 }}>No attachment</span>
                  )}
                  {canEdit && (
                    <span onClick={pickAttachment} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                      {selected.attachmentPath ? "Replace" : "+ Attach file"}
                    </span>
                  )}
                </div>
                <input ref={fileRef} type="file" onChange={onAttachmentChosen} style={{ display: "none" }} />
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 2, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Submissions</span>
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {selected.submissions.filter((s) => s.status !== "PENDING").length}/{selected.submissions.length}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
                {selected.submissions.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: avatarColorFor(s.studentId), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: "#fff", flex: "none" }}>
                        {initials(s.student.name)}
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.student.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                      {canEdit && (
                        <input
                          type="number"
                          min={0}
                          max={10}
                          placeholder="—"
                          defaultValue={s.score ?? undefined}
                          onBlur={(e) => updateScore(s.id, e.target.value)}
                          className="mono"
                          style={{ width: 34, fontSize: 11, textAlign: "center", border: "1px solid var(--line)", borderRadius: 5, padding: "3px 0" }}
                          title="Score out of 10"
                        />
                      )}
                      <span
                        className="pill"
                        onClick={() => toggleStatus(s)}
                        style={{ background: STATUS_STYLE[s.status].bg, color: STATUS_STYLE[s.status].fg, cursor: canEdit ? "pointer" : "default" }}
                      >
                        {s.status[0] + s.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {canEdit && (
              <button
                onClick={remind}
                disabled={pending}
                style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: 10, textAlign: "center", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
              >
                {reminded !== null ? `Reminded ${reminded} student${reminded === 1 ? "" : "s"}` : "Remind pending students"}
              </button>
            )}
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No assignments yet.</div>
        )}
      </div>
      </div>
    </div>
  );
}
