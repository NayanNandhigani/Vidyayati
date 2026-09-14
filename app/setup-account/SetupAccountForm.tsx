"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeAccountSetup, type SetupAccountState } from "./actions";

const initialState: SetupAccountState = {};

export default function SetupAccountForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(completeAccountSetup, initialState);
  const [mismatch, setMismatch] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      const t = setTimeout(() => router.push("/signin"), 1400);
      return () => clearTimeout(t);
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <div style={{ fontSize: 13.5, color: "var(--good)", fontWeight: 600 }}>
        Password set. Taking you to the login page…
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const newPassword = (form.elements.namedItem("newPassword") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;
    if (newPassword !== confirmPassword) {
      e.preventDefault();
      setMismatch(true);
      return;
    }
    setMismatch(false);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="token" value={token} />
      <label className="field">
        New password
        <input className="in" type="password" name="newPassword" required minLength={8} autoComplete="new-password" autoFocus />
      </label>
      <label className="field">
        Confirm password
        <input className="in" type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" />
      </label>
      {mismatch && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          Passwords don&apos;t match.
        </p>
      )}
      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Setting up…" : "Set password & continue"}
      </button>
    </form>
  );
}
