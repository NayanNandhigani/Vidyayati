"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createHomework, type HomeworkFormState } from "../actions";

const initialState: HomeworkFormState = {};

export default function NewHomeworkForm({
  classes,
  subjects,
  isAdmin,
  staff,
}: {
  classes: { id: string; grade: string; section: string; classTeacherStaffId: string | null }[];
  subjects: { id: string; name: string }[];
  isAdmin: boolean;
  staff: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createHomework, initialState);
  const [classId, setClassId] = useState("");
  const [staffId, setStaffId] = useState("");

  function onClassChange(id: string) {
    setClassId(id);
    // Default the "assigned by" picker to that class's own teacher when one
    // is set — still overridable, and required when none is set (a School
    // Admin has no staff record of their own to fall back to).
    const cls = classes.find((c) => c.id === id);
    setStaffId(cls?.classTeacherStaffId ?? "");
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
      <label className="field">
        Title
        <input className="in" name="title" required placeholder="Chapter 4 — Algebra basics" />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Class
          <select className="in" name="classId" required value={classId} onChange={(e) => onClassChange(e.target.value)}>
            <option value="" disabled>
              Select class
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Subject
          <select className="in" name="subjectId" required defaultValue="">
            <option value="" disabled>
              Select subject
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isAdmin && (
        <label className="field">
          Assigned by <span style={{ fontWeight: 400, color: "var(--muted)" }}>(which teacher this shows as)</span>
          <select className="in" name="staffId" required value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="" disabled>
              Select teacher
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        Due date
        <input className="in" type="date" name="dueDate" required />
      </label>

      <label className="field">
        Description
        <textarea className="in" name="description" rows={4} placeholder="What should students do?" />
      </label>

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
          {pending ? "Assigning…" : "Assign homework"}
        </button>
        <Link href="/app/homework" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
