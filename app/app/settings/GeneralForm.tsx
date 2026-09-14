"use client";

import { useActionState, useState, useTransition } from "react";
import { saveGeneral, type FormState } from "./actions";
import { updateAdmissionNoPrefix } from "../students/depth-actions";

const initialState: FormState = {};

export default function GeneralForm({ school }: { school: { name: string; city: string | null; state: string | null; admissionNoPrefix: string | null } }) {
  const [state, formAction, pending] = useActionState(saveGeneral, initialState);
  const [prefix, setPrefix] = useState(school.admissionNoPrefix ?? "");
  const [, startPrefixTransition] = useTransition();

  return (
    <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
          School information
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Basic details used across report cards, ID cards and communication.</div>
      </div>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label className="field">
            School name
            <input className="in" name="name" defaultValue={school.name} required />
          </label>
          <label className="field">
            City
            <input className="in" name="city" defaultValue={school.city ?? ""} />
          </label>
          <label className="field">
            State
            <input className="in" name="state" defaultValue={school.state ?? ""} />
          </label>
        </div>
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: pending ? "default" : "pointer" }}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          {state.success && (
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--good)" }}>
              ✓ Saved
            </span>
          )}
        </div>
      </form>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
        <label className="field" style={{ maxWidth: 260 }}>
          Admission number prefix
          <input
            className="in"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            onBlur={() => startPrefixTransition(() => updateAdmissionNoPrefix(prefix))}
            placeholder="e.g. STU"
          />
        </label>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
          Used only to pre-fill the "Suggest" button on the New Student form — admission numbers stay freely editable.
        </div>
      </div>
    </div>
  );
}
