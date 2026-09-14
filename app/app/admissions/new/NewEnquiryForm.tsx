"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createEnquiry, type EnquiryFormState } from "../actions";

const initialState: EnquiryFormState = {};

export default function NewEnquiryForm() {
  const [state, formAction, pending] = useActionState(createEnquiry, initialState);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
      <label className="field">
        Applicant name
        <input className="in" name="applicantName" required placeholder="Priya Nair" />
      </label>
      <label className="field">
        Parent name
        <input className="in" name="parentName" placeholder="Ravi Nair" />
      </label>
      <label className="field">
        Contact number
        <input className="in mono" name="parentContact" required placeholder="+91 98XXX XXXXX" />
      </label>
      <label className="field">
        Address
        <textarea className="in" name="address" rows={2} />
      </label>
      <label className="field">
        Class applying for
        <input className="in" name="classApplied" required placeholder="Class 2" />
      </label>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Add enquiry"}
        </button>
        <Link href="/app/admissions" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
