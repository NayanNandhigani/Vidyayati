"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ChangePasswordFormState = { error?: string; success?: boolean };

export default function ChangePasswordForm({
  action,
  redirectTo,
  forced,
}: {
  action: (prevState: ChangePasswordFormState, formData: FormData) => Promise<ChangePasswordFormState>;
  redirectTo: string;
  forced?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [mismatch, setMismatch] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.push(redirectTo);
  }, [state.success, redirectTo, router]);

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
    <form action={formAction} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 380 }}>
      {forced && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          For security, you need to set a new password before continuing — this account is still on the one it was created with.
        </p>
      )}
      <label className="field">
        Current password
        <input className="in" type="password" name="currentPassword" required autoComplete="current-password" />
      </label>
      <label className="field">
        New password
        <input className="in" type="password" name="newPassword" required minLength={8} autoComplete="new-password" />
      </label>
      <label className="field">
        Confirm new password
        <input className="in" type="password" name="confirmPassword" required minLength={8} autoComplete="new-password" />
      </label>
      {mismatch && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          New password and confirmation don&apos;t match.
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
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
