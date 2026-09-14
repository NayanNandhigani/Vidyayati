"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateAccount, type FormState } from "./actions";

const initialState: FormState = {};

export default function AccountForms({ name, username }: { name: string; username: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateAccount, initialState);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 460 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
          Profile
        </div>
        <form action={profileAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="field">
            Name
            <input className="in" name="name" defaultValue={name} required />
          </label>
          <label className="field">
            Username
            <input className="in mono" defaultValue={username} disabled style={{ background: "var(--paper)", color: "var(--muted)" }} />
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="submit" disabled={profilePending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {profilePending ? "Saving…" : "Save changes"}
            </button>
            {profileState.success && (
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--good)" }}>
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
          Security
        </div>
        <Link
          href="/super-admin/change-password"
          style={{ display: "inline-block", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}
        >
          Change password →
        </Link>
      </div>
    </div>
  );
}
