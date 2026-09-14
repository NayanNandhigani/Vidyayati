"use client";

import { useActionState, useRef, useTransition } from "react";
import Link from "next/link";
import { createStudent, type StudentFormState } from "../actions";
import { suggestAdmissionNo } from "../depth-actions";

const initialState: StudentFormState = {};

export default function NewStudentForm({ classes }: { classes: { id: string; grade: string; section: string }[] }) {
  const [state, formAction, pending] = useActionState(createStudent, initialState);
  const admissionNoRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  function suggest() {
    startTransition(async () => {
      const value = await suggestAdmissionNo();
      if (admissionNoRef.current) admissionNoRef.current.value = value;
    });
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          First name
          <input className="in" name="firstName" required placeholder="Aarav" />
        </label>
        <label className="field">
          Surname
          <input className="in" name="surname" required placeholder="Mehta" />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Admission number
          <div style={{ display: "flex", gap: 6 }}>
            <input ref={admissionNoRef} className="in" name="admissionNo" required placeholder="AD-2050" style={{ flex: 1 }} />
            <span
              onClick={suggest}
              title="Suggest the next number — feel free to edit it"
              style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer", whiteSpace: "nowrap", alignSelf: "center" }}
            >
              Suggest
            </span>
          </div>
        </label>
        <label className="field">
          Class
          <select className="in" name="classId" required defaultValue="">
            <option value="" disabled>
              Select class
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grade}-{c.section}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Date of birth
          <input className="in" type="date" name="dob" />
        </label>
        <label className="field">
          Gender
          <select className="in" name="gender" defaultValue="">
            <option value="">Not specified</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
      </div>

      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Saving…" : "Add student"}
        </button>
        <Link
          href="/app/students"
          style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
