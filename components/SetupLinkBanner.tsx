"use client";

import { useState } from "react";

/** Shown exactly once, right after a new account is created — the raw setup token only ever exists in this one-shot query param, never stored anywhere retrievable later. Refreshing the page loses it, by design. */
export default function SetupLinkBanner({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/setup-account?token=${token}` : "";

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="card" style={{ padding: "16px 18px", background: "var(--good-tint)", border: "1px solid var(--good)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--good)" }}>Account created — share this one-time setup link</div>
      <div style={{ fontSize: 12, color: "var(--ink2)" }}>
        This link lets them set their own password. It won&apos;t be shown again after you leave this page, and it expires in 7 days.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="in mono" readOnly value={url} style={{ fontSize: 11.5, flex: 1 }} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={copy}
          style={{ background: copied ? "var(--good)" : "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flex: "none" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
