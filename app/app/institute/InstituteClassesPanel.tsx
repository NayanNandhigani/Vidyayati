"use client";

import { useActionState, useState, useTransition } from "react";
import { createClass, setClassTeacher, deleteClass, type FormState } from "./actions";
import { updateClassCapacityAndBoard, addCoTeacher, removeCoTeacher } from "./depth-actions";
import { updateClassRteQuota } from "./compliance-actions";

type ClassRow = {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  classTeacherId: string | null;
  classTeacherName: string | null;
  maxStrength: number | null;
  board: string | null;
  rteQuotaSeats: number | null;
  coTeachers: { staffId: string; name: string }[];
};
type Staff = { id: string; name: string };

const initialState: FormState = {};

export default function InstituteClassesPanel({ classes, staff, showCapacity, showCoTeacher, showRte }: { classes: ClassRow[]; staff: Staff[]; showCapacity: boolean; showCoTeacher: boolean; showRte: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(createClass, initialState);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 20 }}>
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
            Classes &amp; sections
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Set up the classes (grades) and sections your school runs this year, and assign each one a class teacher.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{ flex: "none", background: showForm ? "var(--card)" : "var(--marigold)", color: showForm ? "var(--ink)" : "#fff", border: showForm ? "1px solid var(--line)" : "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "+ Add class"}
        </button>
      </div>

      {showForm && (
        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 16, marginBottom: 20, maxWidth: 620 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr", gap: 12 }}>
            <label className="field">
              Grade
              <input className="in" name="grade" placeholder="6" required />
            </label>
            <label className="field">
              Section
              <input className="in" name="section" placeholder="B" required maxLength={3} />
            </label>
            <label className="field">
              Class teacher (optional)
              <select className="in" name="classTeacherStaffId" defaultValue="">
                <option value="">— Unassigned —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {state.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{state.error}</div>}
          <div>
            <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {pending ? "Adding…" : "Add class"}
            </button>
          </div>
        </form>
      )}

      {classes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No classes set up yet for this year.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {classes.map((c) => (
            <ClassThumbnail key={c.id} cls={c} staff={staff} showCapacity={showCapacity} showCoTeacher={showCoTeacher} showRte={showRte} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassThumbnail({ cls, staff, showCapacity, showCoTeacher, showRte }: { cls: ClassRow; staff: Staff[]; showCapacity: boolean; showCoTeacher: boolean; showRte: boolean }) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [maxStrength, setMaxStrength] = useState(cls.maxStrength?.toString() ?? "");
  const [board, setBoard] = useState(cls.board ?? "");
  const [rteQuota, setRteQuota] = useState(cls.rteQuotaSeats?.toString() ?? "");
  const [addingCoTeacher, setAddingCoTeacher] = useState(false);

  const overCapacity = cls.maxStrength != null && cls.studentCount > cls.maxStrength;
  const availableCoTeachers = staff.filter((s) => !cls.coTeachers.some((ct) => ct.staffId === s.id) && s.id !== cls.classTeacherId);

  function handleTeacherChange(staffId: string) {
    startTransition(async () => {
      await setClassTeacher(cls.id, staffId || null);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteClass(cls.id);
      setError(res.error ?? null);
    });
  }

  function saveCapacity() {
    startTransition(() => updateClassCapacityAndBoard(cls.id, maxStrength ? Number(maxStrength) : null, board));
  }

  function saveRteQuota() {
    startTransition(() => updateClassRteQuota(cls.id, rteQuota ? Number(rteQuota) : null));
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        border: overCapacity ? "1px solid var(--critical)" : undefined,
        background: overCapacity ? "var(--critical-tint)" : "var(--card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          Class {cls.grade}-{cls.section}
        </div>
        <span onClick={handleDelete} title="Delete class" style={{ color: "var(--critical)", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>
          Delete
        </span>
      </div>

      <div className="mono" style={{ fontSize: 12.5, color: overCapacity ? "var(--critical)" : "var(--muted)", fontWeight: overCapacity ? 700 : 400 }}>
        {cls.studentCount} student{cls.studentCount === 1 ? "" : "s"}
        {cls.maxStrength != null && ` / ${cls.maxStrength}`}
      </div>
      {overCapacity && (
        <div style={{ color: "var(--critical)", fontSize: 11, fontWeight: 600 }}>
          Over capacity by {cls.studentCount - cls.maxStrength!}
        </div>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--faint)" }}>
        Class teacher
        <select
          key={cls.classTeacherId ?? "none"}
          className="in"
          defaultValue={cls.classTeacherId ?? ""}
          onChange={(e) => handleTeacherChange(e.target.value)}
          style={{ fontSize: 12.5 }}
        >
          <option value="">— Unassigned —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {error && <div style={{ color: "var(--critical)", fontSize: 11.5 }}>{error}</div>}

      {(showCapacity || showCoTeacher || showRte) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 2 }}>
          {showRte && (
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, fontSize: 11, color: "var(--muted)" }}>
              RTE quota seats
              <input
                className="in"
                type="number"
                min={0}
                value={rteQuota}
                onChange={(e) => setRteQuota(e.target.value)}
                onBlur={saveRteQuota}
                style={{ width: 55, fontSize: 11, padding: "3px 6px" }}
              />
            </label>
          )}
          {showCapacity && (
            <>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                Max strength
                <input
                  className="in"
                  type="number"
                  min={0}
                  value={maxStrength}
                  onChange={(e) => setMaxStrength(e.target.value)}
                  onBlur={saveCapacity}
                  style={{ width: 55, fontSize: 11, padding: "3px 6px" }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, fontSize: 11, color: "var(--muted)" }}>
                Board
                <input
                  className="in"
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  onBlur={saveCapacity}
                  placeholder="e.g. CBSE"
                  style={{ width: 90, fontSize: 11, padding: "3px 6px" }}
                />
              </label>
            </>
          )}
          {showCoTeacher && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Co-teachers</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {cls.coTeachers.map((ct) => (
                  <span key={ct.staffId} className="pill" style={{ background: "var(--teal-tint)", color: "var(--teal)", fontSize: 10.5 }}>
                    {ct.name}
                    <span onClick={() => startTransition(() => removeCoTeacher(cls.id, ct.staffId))} style={{ marginLeft: 5, cursor: "pointer" }}>
                      ×
                    </span>
                  </span>
                ))}
                {addingCoTeacher ? (
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) startTransition(() => addCoTeacher(cls.id, e.target.value));
                      setAddingCoTeacher(false);
                    }}
                    onBlur={() => setAddingCoTeacher(false)}
                    style={{ fontSize: 10.5, padding: "3px 6px" }}
                  >
                    <option value="" disabled>
                      Choose staff…
                    </option>
                    {availableCoTeachers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span onClick={() => setAddingCoTeacher(true)} style={{ fontSize: 10.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                    + Add
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
