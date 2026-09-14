"use client";

import { useActionState } from "react";
import { convertToSchool, type FormState } from "./actions";
import ContactPersonFields from "@/components/ContactPersonFields";

const initialState: FormState = {};

export default function ConvertLeadForm({ leadId, plans }: { leadId: string; plans: { id: string; name: string; price: number }[] }) {
  const [state, formAction, pending] = useActionState(convertToSchool, initialState);

  return (
    <div style={{ background: "var(--good-tint)", border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--good)", marginBottom: 10 }}>Convert to School</div>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input type="hidden" name="leadId" value={leadId} />
        <label className="field">
          School Admin name
          <input className="in" name="adminName" required placeholder="e.g. Anil Kumar" />
        </label>
        <label className="field">
          School Admin username
          <input className="in" name="adminUsername" required placeholder="e.g. anil.kumar" />
        </label>
        <label className="field">
          Registration number <span style={{ fontWeight: 500, color: "var(--muted)" }}>(optional)</span>
          <input className="in mono" name="registrationNumber" placeholder="e.g. UDISE / affiliation number" />
        </label>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
          Contact person <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>— name, phone & email carried over from the lead</span>
        </div>
        <ContactPersonFields showIdentityFields={false} />
        {plans.length > 0 && (
          <label className="field">
            Subscription plan (optional — creates the first invoice)
            <select className="in" name="planId" defaultValue="">
              <option value="">No plan yet</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · ₹{p.price.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </label>
        )}
        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
          Default password: <span className="mono">12345</span>
        </div>
        {state.error && (
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} style={{ background: "var(--good)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Converting…" : "Convert to School →"}
        </button>
      </form>
    </div>
  );
}
