"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { buildContractTemplate } from "@/lib/contract-template";
import { createContract, type ContractFormState } from "./actions";

const initialState: ContractFormState = {};

export default function NewContractForm({ schools, defaultSchoolId }: { schools: { id: string; name: string }[]; defaultSchoolId?: string }) {
  const [state, formAction, pending] = useActionState(createContract, initialState);
  const [schoolId, setSchoolId] = useState(defaultSchoolId ?? "");
  const [billingCycle, setBillingCycle] = useState("YEARLY");
  const [annualFee, setAnnualFee] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextYear);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertTemplate() {
    const school = schools.find((s) => s.id === schoolId);
    if (!textareaRef.current) return;
    textareaRef.current.value = buildContractTemplate({
      schoolName: school?.name ?? "the School",
      billingCycle,
      annualFee: Number(annualFee) || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingRight: 2 }}>
        <label className="field">
          School
          <select className="in" name="schoolId" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="" disabled>
              Select school
            </option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label className="field">
            Billing cycle
            <select className="in" name="billingCycle" value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
              <option value="YEARLY">Yearly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label className="field">
            Annual fee (₹)
            <input className="in mono" type="number" name="annualFee" required min={0} placeholder="185000" value={annualFee} onChange={(e) => setAnnualFee(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label className="field">
            Start date
            <input className="in mono" type="date" name="startDate" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            End date
            <input className="in mono" type="date" name="endDate" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Contract terms</span>
            <span onClick={insertTemplate} style={{ color: "var(--marigold-deep)", fontWeight: 700, cursor: "pointer", fontSize: 11.5 }}>
              Insert standard template
            </span>
          </div>
          <textarea ref={textareaRef} className="in mono" name="termsBody" rows={14} placeholder="Click “Insert standard template” to start from Vidya Yati's standard agreement, then edit as needed." style={{ resize: "vertical", lineHeight: 1.5, fontSize: 12 }} />
        </label>
      </div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px", flex: "none" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flex: "none" }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Creating…" : "Create contract"}
        </button>
        <Link href="/super-admin/contracts" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
