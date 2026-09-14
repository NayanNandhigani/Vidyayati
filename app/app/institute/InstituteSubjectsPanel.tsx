"use client";

import { useActionState, useState, useTransition } from "react";
import { createSubject, deleteSubject, setClassSubjectTeacher, type FormState } from "./actions";
import { updateSubjectDetail } from "./depth-actions";

type ClassOption = { id: string; grade: string; section: string };
type Staff = { id: string; name: string };
type Subject = { id: string; name: string; teacherByClass: Record<string, string>; isElective: boolean; credits: number | null };

const initialState: FormState = {};

export default function InstituteSubjectsPanel({ subjects, classes, staff, showCapacity }: { subjects: Subject[]; classes: ClassOption[]; staff: Staff[]; showCapacity: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(createSubject, initialState);

  return (
    <div style={{ maxWidth: 640, width: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
          Subjects
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          The subjects taught across your school. Assign each one to the classes it's taught in, and who teaches it there.
        </div>
      </div>

      {subjects.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>No subjects added yet.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {subjects.map((s) => (
          <SubjectRow key={s.id} subject={s} classes={classes} staff={staff} showCapacity={showCapacity} />
        ))}
      </div>

      {showForm ? (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
          <label className="field">
            Subject name
            <input className="in" name="name" placeholder="Mathematics" required />
          </label>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>Assign to classes (optional — you can also do this later)</div>
            <ClassTeacherTable classes={classes} staff={staff} teacherByClass={{}} mode="form" />
          </div>

          {state.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{state.error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Adding…" : "Add subject"}
            </button>
            <span onClick={() => setShowForm(false)} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", cursor: "pointer", padding: "8px 4px" }}>
              Cancel
            </span>
          </div>
        </form>
      ) : (
        <span onClick={() => setShowForm(true)} style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
          + Add subject
        </span>
      )}
    </div>
  );
}

function ClassTeacherTable({
  classes,
  staff,
  teacherByClass,
  mode,
  onAssign,
}: {
  classes: ClassOption[];
  staff: Staff[];
  teacherByClass: Record<string, string>;
  mode: "form" | "live";
  onAssign?: (classId: string, staffId: string) => void;
}) {
  if (classes.length === 0) {
    return <div style={{ padding: 12, fontSize: 12.5, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 8 }}>No classes set up yet.</div>;
  }

  return (
    <div style={{ maxHeight: 320, overflowY: "auto", padding: 2 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {classes.map((c) => {
          const assigned = !!teacherByClass[c.id];
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${assigned ? "var(--teal)" : "var(--line)"}`,
                background: assigned ? "var(--teal-tint)" : "var(--paper)",
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                Class {c.grade}-{c.section}
              </div>
              <select
                key={mode === "live" ? `${c.id}-${teacherByClass[c.id] ?? "none"}` : undefined}
                name={mode === "form" ? `teacher_${c.id}` : undefined}
                className="in"
                defaultValue={teacherByClass[c.id] ?? ""}
                onChange={mode === "live" && onAssign ? (e) => onAssign(c.id, e.target.value) : undefined}
                style={{ background: "var(--card)", fontSize: 11.5 }}
              >
                <option value="">— Not taught here —</option>
                {staff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectRow({ subject, classes, staff, showCapacity }: { subject: Subject; classes: ClassOption[]; staff: Staff[]; showCapacity: boolean }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isElective, setIsElective] = useState(subject.isElective);
  const [credits, setCredits] = useState(subject.credits?.toString() ?? "");

  const classCount = Object.keys(subject.teacherByClass).length;

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSubject(subject.id);
      setError(res.error ?? null);
    });
  }

  function handleAssign(classId: string, staffId: string) {
    startTransition(async () => {
      await setClassSubjectTeacher(classId, subject.id, staffId || null);
    });
  }

  function toggleElective() {
    const next = !isElective;
    setIsElective(next);
    startTransition(() => updateSubjectDetail(subject.id, next, credits ? Number(credits) : null));
  }

  function saveCredits() {
    startTransition(() => updateSubjectDetail(subject.id, isElective, credits ? Number(credits) : null));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--paper)", borderRadius: expanded ? "8px 8px 0 0" : 8 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{subject.name}</div>
            {showCapacity && isElective && (
              <span className="pill" style={{ background: "var(--marigold-tint)", color: "var(--marigold-deep)", fontSize: 10 }}>
                Elective
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
            {classCount === 0 ? "Not taught in any class yet" : `Taught in ${classCount} class${classCount === 1 ? "" : "es"}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {showCapacity && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                <input type="checkbox" checked={isElective} onChange={toggleElective} />
                Elective
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                Credits
                <input
                  className="in"
                  type="number"
                  min={0}
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  onBlur={saveCredits}
                  style={{ width: 44, fontSize: 11, padding: "3px 5px" }}
                />
              </label>
            </>
          )}
          <span onClick={() => setExpanded((v) => !v)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
            {expanded ? "Hide classes & teachers" : "Manage classes & teachers"}
          </span>
          <span onClick={handleDelete} style={{ color: "var(--critical)", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>
            Delete
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: 10, background: "var(--card)" }}>
          <ClassTeacherTable classes={classes} staff={staff} teacherByClass={subject.teacherByClass} mode="live" onAssign={handleAssign} />
        </div>
      )}
      {error && <div style={{ color: "var(--critical)", fontSize: 12, padding: "4px 14px" }}>{error}</div>}
    </div>
  );
}
