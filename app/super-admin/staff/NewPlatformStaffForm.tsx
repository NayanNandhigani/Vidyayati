"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPlatformStaff, type StaffFormState } from "./actions";

const initialState: StaffFormState = {};

export default function NewPlatformStaffForm() {
  const [state, formAction, pending] = useActionState(createPlatformStaff, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 }}>
      <label className="field">
        Full name
        <input className="in" name="name" required placeholder="Arjun Malhotra" />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Username
          <input className="in" type="text" name="username" required placeholder="e.g. arjun.malhotra" />
        </label>
        <label className="field">
          Phone
          <input className="in mono" name="phone" placeholder="+91 98XXX XXXXX" />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Title
          <input className="in" name="title" placeholder="Onboarding Manager" />
        </label>
        <label className="field">
          Department
          <input className="in" name="department" placeholder="Sales" />
        </label>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Default password: <span className="mono">12345</span>. New staff start with no module access — grant it from their profile after adding them.
      </div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Adding…" : "Add staff"}
        </button>
        <Link href="/super-admin/staff" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
