"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSchoolStatus, type ManageFormState } from "./actions";

const initialState: ManageFormState = {};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "TRIAL", label: "Trial" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRING", label: "Expiring soon" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function StatusForm({ school }: { school: { id: string; status: string } }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateSchoolStatus, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!editing) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
        <div>
          <span style={{ color: "var(--muted)" }}>Status:</span> {STATUS_OPTIONS.find((o) => o.value === school.status)?.label ?? school.status}
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
      <label className="field">
        Status
        <select className="in" name="status" defaultValue={school.status}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

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
