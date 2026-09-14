"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createExam, type ExamFormState } from "../actions";

const initialState: ExamFormState = {};

export default function NewExamForm({
  classes,
  subjects,
}: {
  classes: { id: string; grade: string; section: string }[];
  subjects: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createExam, initialState);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set(subjects.map((s) => s.id)));
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleClass(id: string) {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
      <label className="field">
        Exam name
        <input className="in" name="name" required placeholder="Mid-Term Examination" />
      </label>

      <div className="field">
        Classes <span style={{ fontWeight: 400, color: "var(--muted)" }}>(select every section this exam applies to)</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {classes.map((c) => {
            const checked = selectedClasses.has(c.id);
            return (
              <label
                key={c.id}
                className="pill"
                style={{ cursor: "pointer", background: checked ? "var(--marigold)" : "var(--card)", color: checked ? "#fff" : "var(--ink2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6 }}
              >
                <input type="checkbox" name="classIds" value={c.id} checked={checked} onChange={() => toggleClass(c.id)} style={{ margin: 0 }} />
                {c.grade}-{c.section}
              </label>
            );
          })}
          {classes.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No classes set up yet for this school.</div>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Start date
          <input className="in" type="date" name="startDate" required />
        </label>
        <label className="field">
          End date
          <input className="in" type="date" name="endDate" required />
        </label>
      </div>

      <div className="field">
        Subjects &amp; max marks
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {subjects.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                name="subjectIds"
                value={s.id}
                checked={selectedSubjects.has(s.id)}
                onChange={() => toggle(s.id)}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{s.name}</span>
              <input className="in" type="number" name={`maxMarks_${s.id}`} defaultValue={100} style={{ width: 70 }} disabled={!selectedSubjects.has(s.id)} />
            </div>
          ))}
          {subjects.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No subjects set up yet for this school.</div>}
        </div>
      </div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Scheduling…" : "Schedule exam"}
        </button>
        <Link href="/app/exams" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
