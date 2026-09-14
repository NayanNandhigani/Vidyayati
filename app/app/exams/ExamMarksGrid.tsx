"use client";

import { useMemo, useState, useTransition } from "react";
import { initials, studentName } from "@/lib/format";
import { avatarColorFor, gradeFor, gradeForScale, gradeColor, type GradeBand } from "@/lib/academic";
import { saveMarks } from "./actions";

type Student = { id: string; firstName: string; surname: string };
type ExamSubject = { id: string; maxMarks: number; subject: { id: string; name: string } };

const PASS_MARK = 33;

export default function ExamMarksGrid({
  examId,
  examName,
  className,
  students,
  examSubjects,
  initialMarks,
  canEdit,
  gradeBands,
}: {
  examId: string;
  examName: string;
  className: string;
  students: Student[];
  examSubjects: ExamSubject[];
  initialMarks: Record<string, Record<string, number>>;
  canEdit: boolean;
  gradeBands: GradeBand[];
}) {
  const gradeForPct = (pct: number) => gradeForScale(pct, gradeBands) ?? gradeFor(pct);
  const [marks, setMarks] = useState(initialMarks);
  const [previewId, setPreviewId] = useState(students[0]?.id ?? null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [sortField, setSortField] = useState<"name" | "total">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const maxTotal = examSubjects.reduce((s, es) => s + es.maxMarks, 0);

  function setMark(studentId: string, examSubjectId: string, value: number) {
    setMarks((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [examSubjectId]: value } }));
    setSaved(false);
  }

  function rowTotal(studentId: string) {
    const row = marks[studentId] ?? {};
    return examSubjects.reduce((s, es) => s + (row[es.id] ?? 0), 0);
  }

  function toggleSort(field: "name" | "total") {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir(field === "total" ? "desc" : "asc");
    }
  }

  // Sorted client-side — this grid already holds every student+mark for
  // one exam/class in memory, no server round-trip needed to reorder it.
  const sortedStudents = useMemo(() => {
    const sorted = [...students].sort((a, b) =>
      sortField === "name" ? studentName(a).localeCompare(studentName(b)) : rowTotal(a.id) - rowTotal(b.id)
    );
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [students, sortField, sortDir, marks]);

  function save() {
    startTransition(async () => {
      await saveMarks(examId, marks);
      setSaved(true);
    });
  }

  const preview = useMemo(() => {
    if (!previewId) return null;
    const student = students.find((s) => s.id === previewId);
    if (!student) return null;
    const row = marks[previewId] ?? {};
    const total = rowTotal(previewId);
    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
    const rank = [...students]
      .map((s) => ({ id: s.id, total: rowTotal(s.id) }))
      .sort((a, b) => b.total - a.total)
      .findIndex((s) => s.id === previewId) + 1;
    return { student, row, total, pct, rank };
  }, [previewId, marks, students, examSubjects, maxTotal]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {examName} · {className} · Marks Entry
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>Pass mark {PASS_MARK} per subject · click a cell to preview that student's report card</div>
          </div>
          {canEdit && (
            <button
              onClick={save}
              disabled={pending}
              style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1, flex: "none" }}
            >
              {pending ? "Saving…" : saved ? "Saved ✓" : "Save Marks"}
            </button>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `1.75fr repeat(${examSubjects.length}, 0.8fr) 0.85fr 0.8fr`,
            padding: "11px 20px",
            borderBottom: "1px solid var(--line)",
            fontSize: 10,
            color: "var(--faint)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <div onClick={() => toggleSort("name")} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: sortField === "name" ? "var(--marigold-deep)" : undefined }}>
            Student <span style={{ fontSize: 9, opacity: sortField === "name" ? 1 : 0.35 }}>{sortField === "name" && sortDir === "desc" ? "▼" : "▲"}</span>
          </div>
          {examSubjects.map((es) => (
            <div key={es.id} style={{ textAlign: "center" }}>
              {es.subject.name}
            </div>
          ))}
          <div onClick={() => toggleSort("total")} style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: sortField === "total" ? "var(--marigold-deep)" : undefined }}>
            Total <span style={{ fontSize: 9, opacity: sortField === "total" ? 1 : 0.35 }}>{sortField === "total" && sortDir === "asc" ? "▲" : "▼"}</span>
          </div>
          <div style={{ textAlign: "center" }}>%</div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {students.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No students in this class.</div>}
          {sortedStudents.map((s) => {
            const total = rowTotal(s.id);
            const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            const selected = s.id === previewId;
            return (
              <div
                key={s.id}
                onClick={() => setPreviewId(s.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: `1.75fr repeat(${examSubjects.length}, 0.8fr) 0.85fr 0.8fr`,
                  alignItems: "center",
                  padding: "10.5px 20px",
                  borderBottom: "1px solid var(--line)",
                  background: selected ? "var(--marigold-tint)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: avatarColorFor(s.id), fontSize: 10.5, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flex: "none" }}>
                    {initials(studentName(s))}
                  </div>
                  <div style={{ fontWeight: selected ? 700 : 600, fontSize: 13 }}>{studentName(s)}</div>
                </div>
                {examSubjects.map((es) => {
                  const v = marks[s.id]?.[es.id];
                  const failing = v !== undefined && v < PASS_MARK;
                  return (
                    <input
                      key={es.id}
                      type="number"
                      min={0}
                      max={es.maxMarks}
                      value={v ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setMark(s.id, es.id, Math.max(0, Math.min(es.maxMarks, Number(e.target.value))))}
                      disabled={!canEdit}
                      className="mono"
                      style={{
                        width: "100%",
                        textAlign: "center",
                        border: canEdit ? `1px solid ${failing ? "var(--critical-border)" : "var(--marigold-tint)"}` : "none",
                        background: failing ? "var(--critical-tint)" : canEdit ? "var(--marigold-tint)" : "transparent",
                        color: failing ? "var(--critical)" : "var(--ink)",
                        fontWeight: 700,
                        fontSize: 13,
                        borderRadius: 5,
                        padding: "5px 0",
                        margin: "1px 0",
                      }}
                    />
                  );
                })}
                <div className="mono" style={{ textAlign: "center", fontWeight: 700 }}>
                  {total}
                </div>
                <div className="mono" style={{ textAlign: "center", fontWeight: 700, color: pct >= 90 ? "var(--good)" : pct >= 33 ? "var(--marigold-deep)" : "var(--critical)" }}>
                  {pct.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Report Card Preview</div>
        {preview ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: avatarColorFor(preview.student.id), fontSize: 14.5, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flex: "none" }}>
                {initials(studentName(preview.student))}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{studentName(preview.student)}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {className} · {examName}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 14 }}>
              {examSubjects.map((es) => {
                const v = preview.row[es.id] ?? 0;
                const pct = (v / es.maxMarks) * 100;
                return (
                  <div key={es.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--muted)" }}>{es.subject.name}</span>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {v}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "var(--marigold-tint)" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, borderRadius: 4, background: "var(--marigold)" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Total</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {preview.total} / {maxTotal}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Percentage</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {preview.pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Grade</span>
                <span className="pill" style={{ background: "var(--paper)", color: gradeColor(gradeForPct(preview.pct)), border: "1px solid var(--line)", fontSize: 13, padding: "4px 12px" }}>
                  {gradeForPct(preview.pct)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Rank in class</span>
                <span className="mono" style={{ fontWeight: 700 }}>
                  {preview.rank} of {students.length}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Select a student to preview their report card.</div>
        )}
      </div>
    </div>
  );
}
