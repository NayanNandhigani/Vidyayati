"use client";

import { useActionState, useState } from "react";
import { createLead, type LeadFormState } from "./actions";
import AddressFields from "@/components/AddressFields";

const initialState: LeadFormState = {};

export default function NewLeadForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLead, initialState);

  if (!open) {
    return (
      <span onClick={() => setOpen(true)} style={{ cursor: "pointer", background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700 }}>
        + Add lead
      </span>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: 18, marginBottom: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
        <label className="field">
          Proposed school name
          <input className="in" name="schoolNameProposed" required placeholder="e.g. Riverdale Public School" />
        </label>
        <label className="field">
          Source
          <select className="in" name="source" defaultValue="REFERRAL">
            <option value="REFERRAL">Referral</option>
            <option value="WEBSITE">Website</option>
            <option value="COLD_OUTREACH">Cold outreach</option>
            <option value="EVENT">Event</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <label className="field">
          Contact name
          <input className="in" name="contactName" required placeholder="e.g. Anil Kumar" />
        </label>
        <label className="field">
          Contact phone
          <input className="in mono" name="contactPhone" required placeholder="+91 90000 00000" />
        </label>
        <label className="field">
          Contact email
          <input className="in" type="email" name="contactEmail" placeholder="anil@school.edu.in" />
        </label>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Address <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional — carries over if this lead converts to a school)</span>
      </div>
      <AddressFields />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <label className="field">
          Estimated value (₹/yr)
          <input className="in mono" type="number" name="estimatedValue" min={0} placeholder="150000" />
        </label>
        <label className="field">
          Expected close date
          <input className="in mono" type="date" name="expectedCloseDate" />
        </label>
        <label className="field">
          Relationship manager
          <input className="in" name="relationshipManager" placeholder="e.g. Radhika Menon" />
        </label>
      </div>
      {state.error && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Adding…" : "Add lead"}
        </button>
        <span onClick={() => setOpen(false)} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    </form>
  );
}
