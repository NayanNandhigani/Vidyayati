"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label className="field">
        Username
        <input className="in" type="text" name="username" required autoComplete="username" placeholder="e.g. VIDYAYATI" />
      </label>

      <label className="field">
        Password
        <input className="in" type="password" name="password" required autoComplete="current-password" placeholder="••••••••" />
      </label>

      {state.error && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--critical)",
            background: "var(--critical-tint)",
            border: "1px solid var(--critical-border)",
            borderRadius: 8,
            padding: "8px 11px",
          }}
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 4,
          background: "var(--marigold)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 14,
          fontWeight: 700,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
