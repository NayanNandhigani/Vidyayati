"use client";

import { useState, useTransition } from "react";
import type { SyllabusTopicStatus } from "@prisma/client";
import { subjectStyleFor } from "@/lib/academic";
import { addSyllabusTopic, markTopicCovered, reopenTopic, deleteSyllabusTopic, reorderTopic } from "./actions";

type Topic = {
  id: string;
  title: string;
  status: SyllabusTopicStatus;
  coveredOn: string | null;
  note: string | null;
  loggedByName: string | null;
};

type Assignment = {
  key: string;
  classId: string;
  subjectId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  canEdit: boolean;
  topics: Topic[];
  completedCount: number;
  totalCount: number;
};

const STATUS_STYLE: Record<SyllabusTopicStatus, { bg: string; fg: string; label: string }> = {
  PLANNED: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Planned" },
  COMPLETED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Covered" },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TeachingBoard({
  assignments,
  initialSelectedKey,
  showTeacherName,
}: {
  assignments: Assignment[];
  initialSelectedKey: string | null;
  showTeacherName: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState(initialSelectedKey ?? assignments[0]?.key ?? null);
  const [pending, startTransition] = useTransition();
  const [addTitle, setAddTitle] = useState("");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [coveredOn, setCoveredOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = assignments.find((a) => a.key === selectedKey) ?? assignments[0] ?? null;

  function selectAssignment(key: string) {
    setSelectedKey(key);
    setMarkingId(null);
    setError(null);
  }

  function startMarking(t: Topic) {
    setMarkingId(t.id);
    setCoveredOn(t.coveredOn ? t.coveredOn.slice(0, 10) : todayISO());
    setNote(t.note ?? "");
    setError(null);
  }

  function saveMarking(topicId: string) {
    startTransition(async () => {
      const res = await markTopicCovered(topicId, coveredOn, note);
      if (res?.error) {
        setError(res.error);
      } else {
        setMarkingId(null);
        setError(null);
      }
    });
  }

  function reopen(topicId: string) {
    startTransition(async () => {
      await reopenTopic(topicId);
      setMarkingId(null);
    });
  }

  function remove(topicId: string) {
    startTransition(async () => {
      await deleteSyllabusTopic(topicId);
    });
  }

  function move(topicId: string, dir: "up" | "down") {
    startTransition(async () => {
      await reorderTopic(topicId, dir);
    });
  }

  function addTopic() {
    if (!selected || !addTitle.trim()) return;
    const title = addTitle.trim();
    setAddTitle("");
    startTransition(async () => {
      const res = await addSyllabusTopic(selected.classId, selected.subjectId, title);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 13, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, overflowY: "auto", paddingRight: 2 }}>
        {assignments.map((a) => {
          const pct = a.totalCount ? Math.round((a.completedCount / a.totalCount) * 100) : 0;
          const style = subjectStyleFor(a.subjectName);
          const isSelected = a.key === selectedKey;
          return (
            <div
              key={a.key}
              onClick={() => selectAssignment(a.key)}
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
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, background: style.bg, color: style.fg }}>{a.subjectName}</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                  Class {a.className}
                </span>
              </div>
              {showTeacherName && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{a.teacherName}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                  {a.completedCount}/{a.totalCount} topics
                </span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                  {pct}%
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: style.fg, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {selected ? (
          <>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 6, ...subjectStyleFor(selected.subjectName) }}>{selected.subjectName}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                  {selected.totalCount ? Math.round((selected.completedCount / selected.totalCount) * 100) : 0}% covered
                </span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                Class {selected.className} · {selected.subjectName}
              </div>
              {showTeacherName && (
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                  Taught by {selected.teacherName}
                </div>
              )}
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--critical)", background: "var(--critical-tint)", borderRadius: 8, padding: "8px 11px" }}>{error}</div>
            )}

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Syllabus outline</span>
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {selected.completedCount}/{selected.totalCount}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
                {selected.topics.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--faint)", padding: "8px 4px" }}>No topics added yet.</div>
                )}
                {selected.topics.map((t, i) => (
                  <div key={t.id} style={{ background: "var(--paper)", borderRadius: 8, padding: "9px 11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35 }}>{t.title}</div>
                        {t.status === "COMPLETED" && t.coveredOn && (
                          <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>
                            {fmtDate(t.coveredOn)}
                            {t.loggedByName ? ` · ${t.loggedByName}` : ""}
                            {t.note ? ` · ${t.note}` : ""}
                          </div>
                        )}
                      </div>
                      {selected.canEdit && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span
                            onClick={() => move(t.id, "up")}
                            style={{ cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.25 : 1, fontSize: 10, color: "var(--faint)", lineHeight: 1 }}
                            title="Move up"
                          >
                            ▲
                          </span>
                          <span
                            onClick={() => move(t.id, "down")}
                            style={{ cursor: i === selected.topics.length - 1 ? "default" : "pointer", opacity: i === selected.topics.length - 1 ? 0.25 : 1, fontSize: 10, color: "var(--faint)", lineHeight: 1 }}
                            title="Move down"
                          >
                            ▼
                          </span>
                        </div>
                      )}
                      <span
                        className="pill"
                        onClick={() => selected.canEdit && startMarking(t)}
                        style={{ background: STATUS_STYLE[t.status].bg, color: STATUS_STYLE[t.status].fg, cursor: selected.canEdit ? "pointer" : "default", flex: "none" }}
                      >
                        {STATUS_STYLE[t.status].label}
                      </span>
                      {selected.canEdit && (
                        <span onClick={() => remove(t.id)} style={{ cursor: "pointer", color: "var(--faint)", fontSize: 15, lineHeight: 1, flex: "none" }} title="Delete topic">
                          ×
                        </span>
                      )}
                    </div>

                    {markingId === t.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div className="field" style={{ flex: 1 }}>
                            Date covered
                            <input type="date" className="in mono" value={coveredOn} max={todayISO()} onChange={(e) => setCoveredOn(e.target.value)} />
                          </div>
                        </div>
                        <div className="field">
                          Note (optional)
                          <textarea className="in" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was covered, any follow-up needed…" style={{ resize: "vertical", fontFamily: "inherit" }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => saveMarking(t.id)}
                            disabled={pending}
                            style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setMarkingId(null)}
                            style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                          {t.status === "COMPLETED" && (
                            <button
                              onClick={() => reopen(t.id)}
                              disabled={pending}
                              style={{ background: "none", color: "var(--critical)", border: "none", padding: "7px 4px", fontSize: 12, fontWeight: 600, cursor: pending ? "default" : "pointer", marginLeft: "auto" }}
                            >
                              Mark as planned
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selected.canEdit && (
              <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <input
                  className="in"
                  placeholder="Add a topic to the syllabus…"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTopic()}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={addTopic}
                  disabled={pending || !addTitle.trim()}
                  style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: !addTitle.trim() ? 0.5 : 1 }}
                >
                  + Add
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Select a subject to view its syllabus.</div>
        )}
      </div>
    </div>
  );
}
