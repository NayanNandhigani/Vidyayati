"use client";

import { useActionState, useEffect, useState } from "react";
import { upsertSchoolContact, type ManageFormState } from "./actions";
import ContactPersonFields from "@/components/ContactPersonFields";
import { formatAddress } from "@/lib/address";

const initialState: ManageFormState = {};

type SchoolAddress = {
  addressLine: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

type Contact = {
  name: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  addressLine: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  aadharNumber: string | null;
} | null;

function maskAadhar(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) return value;
  return `XXXX-XXXX-${digits.slice(8)}`;
}

function addressesMatch(a: SchoolAddress, b: SchoolAddress | null): boolean {
  if (!b) return true;
  return a.addressLine === b.addressLine && a.mandal === b.mandal && a.district === b.district && a.state === b.state && a.postalCode === b.postalCode;
}

export default function SchoolContactForm({ schoolId, schoolAddress, contact, canManage }: { schoolId: string; schoolAddress: SchoolAddress; contact: Contact; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const [revealAadhar, setRevealAadhar] = useState(false);
  const [state, formAction, pending] = useActionState(upsertSchoolContact, initialState);

  useEffect(() => {
    if (state.success) setEditing(false);
  }, [state.success]);

  if (!editing) {
    if (!contact) {
      return (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: "var(--faint)" }}>
          No contact person on file.
          {canManage && (
            <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontSize: 12, fontWeight: 600, marginLeft: 8 }}>
              Add contact
            </span>
          )}
        </div>
      );
    }

    const formatted = formatAddress(contact);

    return (
      <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "var(--muted)" }}>Name</span>
          <span>{contact.name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "var(--muted)" }}>Phone</span>
          <span className="mono">
            {contact.phone}
            {contact.alternatePhone ? ` / ${contact.alternatePhone}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
          <span style={{ color: "var(--muted)" }}>Email</span>
          <span>{contact.email ?? "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, alignItems: "center" }}>
          <span style={{ color: "var(--muted)" }}>Aadhar</span>
          <span className="mono" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {contact.aadharNumber ? (revealAadhar ? contact.aadharNumber : maskAadhar(contact.aadharNumber)) : "—"}
            {contact.aadharNumber && (
              <span onClick={() => setRevealAadhar((v) => !v)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontWeight: 600, fontFamily: "var(--font-body, sans-serif)", fontSize: 11 }}>
                {revealAadhar ? "Hide" : "Show"}
              </span>
            )}
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: formatted ? "var(--ink)" : "var(--faint)", marginTop: 2 }}>{formatted ?? "No contact address on file."}</div>
        {canManage && (
          <span onClick={() => setEditing(true)} style={{ cursor: "pointer", color: "var(--marigold-deep)", fontSize: 12, fontWeight: 600, alignSelf: "flex-start", marginTop: 2 }}>
            Edit contact
          </span>
        )}
      </div>
    );
  }

  const defaultSameAsSchool = addressesMatch(schoolAddress, contact);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 14 }}>
      <input type="hidden" name="schoolId" value={schoolId} />
      <ContactPersonFields
        defaults={contact ?? undefined}
        addressDefaults={contact ?? undefined}
        defaultSameAsSchool={defaultSameAsSchool}
      />

      {state.error && (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "7px 10px" }}>
          {state.error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
          {pending ? "Saving…" : "Save contact"}
        </button>
        <span onClick={() => setEditing(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    </form>
  );
}
