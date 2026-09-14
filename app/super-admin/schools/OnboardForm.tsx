"use client";

import { useActionState } from "react";
import Link from "next/link";
import { onboardSchool, type SchoolFormState } from "./actions";
import AddressFields from "@/components/AddressFields";
import ContactPersonFields from "@/components/ContactPersonFields";

const initialState: SchoolFormState = {};

export default function OnboardForm() {
  const [state, formAction, pending] = useActionState(onboardSchool, initialState);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Onboard a school</div>
        <Link href="/super-admin/schools" style={{ color: "var(--muted)", fontSize: 17, textDecoration: "none" }}>
          ×
        </Link>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>New schools start on a 30-day trial by default.</div>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 11, overflowY: "auto", flex: 1, minHeight: 0 }}>
        <label className="field">
          School name
          <input className="in" name="name" required placeholder="e.g. Riverdale Public School" />
        </label>
        <label className="field">
          City
          <input className="in" name="city" placeholder="e.g. Ahmedabad" />
        </label>
        <label className="field">
          State
          <input className="in" name="state" placeholder="e.g. Gujarat" />
        </label>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 11, marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Registered address <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional — can be added later)</span>
        </div>
        <label className="field">
          Registration number
          <input className="in mono" name="registrationNumber" placeholder="e.g. UDISE / affiliation number" />
        </label>
        <AddressFields />

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 11, marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Contact person <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional — can be added later)</span>
        </div>
        <ContactPersonFields />

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 11, marginTop: 4, fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Initial admin login
        </div>
        <label className="field">
          Admin name
          <input className="in" name="adminName" required placeholder="e.g. Anil Kumar" />
        </label>
        <label className="field">
          Admin username
          <input className="in" type="text" name="adminUsername" required placeholder="e.g. anil.kumar" />
        </label>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Default password: <span className="mono">12345</span> — the admin can change it after logging in.</div>

        {state.error && (
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
            {state.error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 6, flex: "none" }}>
          <button type="submit" disabled={pending} style={{ flex: 1, textAlign: "center", background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
            {pending ? "Creating…" : "Create school"}
          </button>
          <Link href="/super-admin/schools" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
