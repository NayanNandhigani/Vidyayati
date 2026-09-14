"use client";

import { useActionState, useEffect, useState } from "react";
import { updateSchoolAddress, type ManageFormState } from "./actions";
import AddressFields from "@/components/AddressFields";
import { formatAddress } from "@/lib/address";

const initialState: ManageFormState = {};

type School = {
  id: string;
  registrationNumber: string | null;
  addressLine: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

export default function SchoolAddressForm({ school, canManage }: { school: School; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateSchoolAddress, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  const formatted = formatAddress(school);

  if (!editing) {
    return (
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "var(--muted)" }}>Registration number</span>
          <span className="mono">{school.registrationNumber ?? "—"}</span>
        </div>
        <div style={{ fontSize: 12.5, color: formatted ? "var(--ink)" : "var(--faint)" }}>{formatted ?? "No registered address on file."}</div>
        {canManage && (
          <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontSize: 12, fontWeight: 600, alignSelf: "flex-start", marginTop: 2 }}>
            Edit address
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
      <input type="hidden" name="id" value={school.id} />
      <label className="field">
        Registration number
        <input className="in mono" name="registrationNumber" defaultValue={school.registrationNumber ?? ""} placeholder="e.g. UDISE / affiliation number" />
      </label>
      <AddressFields defaults={school} />

      {state.error && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "7px 10px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Saving…" : "Save address"}
        </button>
        <span onClick={() => setEditing(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    </form>
  );
}
