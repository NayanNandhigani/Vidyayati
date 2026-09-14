"use client";

import { useState, useTransition } from "react";
import { setPrimaryGuardian, updateGuardianContactPreference } from "../depth-actions";

type Link = { id: string; relation: string; isPrimary: boolean; parent: { id: string; name: string; phone: string | null; preferredContactMethod: string | null } };

export default function GuardianRow({ studentId, link }: { studentId: string; link: Link }) {
  const [, startTransition] = useTransition();
  const [pref, setPref] = useState(link.parent.preferredContactMethod ?? "");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--paper)", borderRadius: 8 }}>
      <span className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 10.5 }}>
        {link.relation[0] + link.relation.slice(1).toLowerCase()}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{link.parent.name}</span>
      <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{link.parent.phone ?? "—"}</span>
      <input
        className="in"
        value={pref}
        onChange={(e) => setPref(e.target.value)}
        onBlur={() => startTransition(() => updateGuardianContactPreference(link.parent.id, pref))}
        placeholder="Contact preference"
        style={{ fontSize: 11, padding: "4px 8px", width: 130 }}
      />
      {link.isPrimary ? (
        <span className="pill" style={{ background: "var(--good-tint)", color: "var(--good)", fontSize: 10.5 }}>
          Primary
        </span>
      ) : (
        <span onClick={() => startTransition(() => setPrimaryGuardian(studentId, link.id))} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
          Set primary
        </span>
      )}
    </div>
  );
}
