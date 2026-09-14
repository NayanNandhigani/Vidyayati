"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSchoolCaps, type ManageFormState } from "./actions";

const initialState: ManageFormState = {};

export default function CapsForm({ school }: { school: { id: string; maxStudents: number | null; maxStaff: number | null; studentCount: number; staffCount: number } }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateSchoolCaps, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!editing) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
        <div>
          <span style={{ color: "var(--muted)" }}>Student cap:</span>{" "}
          <span className="mono">
            {school.studentCount} / {school.maxStudents ?? "uncapped"}
          </span>
          &nbsp;·&nbsp;
          <span style={{ color: "var(--muted)" }}>Staff cap:</span>{" "}
          <span className="mono">
            {school.staffCount} / {school.maxStaff ?? "uncapped"}
          </span>
        </div>
        <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontSize: 12, fontWeight: 600 }}>
          Edit
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="id" value={school.id} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          Max students
          <input className="in mono" type="number" name="maxStudents" min={0} defaultValue={school.maxStudents ?? ""} placeholder="Uncapped" />
        </label>
        <label className="field">
          Max staff
          <input className="in mono" type="number" name="maxStaff" min={0} defaultValue={school.maxStaff ?? ""} placeholder="Uncapped" />
        </label>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Leave blank for no limit.</div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "7px 10px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Saving…" : "Save"}
        </button>
        <span onClick={() => setEditing(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    </form>
  );
}
