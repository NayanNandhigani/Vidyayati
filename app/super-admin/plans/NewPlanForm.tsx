"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPlan, type PlansFormState } from "./actions";

const initialState: PlansFormState = {};

export default function NewPlanForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPlan, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state.success]);

  if (!open) {
    return (
      <span onClick={() => setOpen(true)} style={{ cursor: "pointer", background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700 }}>
        + New plan
      </span>
    );
  }

  return (
    <form ref={formRef} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
        <label className="field">
          Plan name
          <input className="in" name="name" required placeholder="e.g. Standard Annual" />
        </label>
        <label className="field">
          Billing cycle
          <select className="in" name="billingCycle" defaultValue="ANNUAL">
            <option value="ANNUAL">Annual</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        <label className="field">
          Price (₹)
          <input className="in mono" type="number" name="price" required min={0} placeholder="65000" />
        </label>
      </div>
      {state.error && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)" }}>{state.error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Adding…" : "Add plan"}
        </button>
        <span onClick={() => setOpen(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    </form>
  );
}
