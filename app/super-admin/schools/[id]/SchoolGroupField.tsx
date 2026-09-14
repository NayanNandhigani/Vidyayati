"use client";

import { useState, useTransition } from "react";
import { createSchoolGroup, assignSchoolGroup } from "../group-actions";

export default function SchoolGroupField({ schoolId, groupId, groups }: { schoolId: string; groupId: string | null; groups: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  function assign(nextGroupId: string) {
    startTransition(() => assignSchoolGroup(schoolId, nextGroupId || null));
  }

  function createAndAssign() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const group = await createSchoolGroup(newName);
      await assignSchoolGroup(schoolId, group.id);
      setNewName("");
      setCreating(false);
    });
  }

  if (creating) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input className="in" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. North Zone Branches" autoFocus style={{ flex: 1 }} />
        <button type="button" disabled={pending} onClick={createAndAssign} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "…" : "Create"}
        </button>
        <span onClick={() => setCreating(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          ×
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select className="in" value={groupId ?? ""} onChange={(e) => assign(e.target.value)} disabled={pending} style={{ flex: 1 }}>
        <option value="">Not part of a group</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <span onClick={() => setCreating(true)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "0 14px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
        + New group
      </span>
    </div>
  );
}
