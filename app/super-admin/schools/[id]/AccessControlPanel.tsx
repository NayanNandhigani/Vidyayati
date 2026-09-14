"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { setSchoolLoginBlock, updateSchoolAdminAccount, type ManageFormState } from "../actions";

const initialState: ManageFormState = {};

export default function AccessControlPanel({
  schoolId,
  loginBlocked,
  admin,
}: {
  schoolId: string;
  loginBlocked: boolean;
  admin: { id: string; name: string; username: string } | null;
}) {
  const [blockPending, startBlockTransition] = useTransition();
  const [editingAccount, setEditingAccount] = useState(false);
  const [state, formAction, pending] = useActionState(updateSchoolAdminAccount, initialState);

  useEffect(() => {
    if (state.success) setEditingAccount(false);
  }, [state.success]);

  function toggleBlock() {
    startBlockTransition(async () => {
      await setSchoolLoginBlock(schoolId, !loginBlocked);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: loginBlocked ? "var(--critical-tint)" : "var(--paper)",
          border: "1px solid " + (loginBlocked ? "var(--critical-border)" : "var(--line)"),
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: loginBlocked ? "var(--critical)" : "var(--ink)" }}>
            {loginBlocked ? "All logins blocked" : "Logins active"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            {loginBlocked ? "No user at this school — Admin, Staff, or Parent — can sign in right now." : "Every user at this school can sign in normally."}
          </div>
        </div>
        <button
          type="button"
          disabled={blockPending}
          onClick={toggleBlock}
          style={{
            background: loginBlocked ? "var(--good)" : "var(--critical)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: blockPending ? "default" : "pointer",
            flex: "none",
          }}
        >
          {blockPending ? "…" : loginBlocked ? "Unblock logins" : "Block all logins"}
        </button>
      </div>

      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
        {!admin ? (
          <div style={{ fontSize: 12.5, color: "var(--faint)" }}>No School Admin account found for this school.</div>
        ) : !editingAccount ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
            <div>
              <span style={{ color: "var(--muted)" }}>School Admin:</span> {admin.name} · <span className="mono">{admin.username}</span>
            </div>
            <span onClick={() => setEditingAccount(true)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontSize: 12, fontWeight: 600 }}>
              Change
            </span>
          </div>
        ) : (
          <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="hidden" name="userId" value={admin.id} />
            <input type="hidden" name="schoolId" value={schoolId} />
            <label className="field">
              Admin name
              <input className="in" name="name" defaultValue={admin.name} required />
            </label>
            <label className="field">
              Admin username
              <input className="in mono" name="username" defaultValue={admin.username} required />
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
              <span onClick={() => setEditingAccount(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
                Cancel
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
