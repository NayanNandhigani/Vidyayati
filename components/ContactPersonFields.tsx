"use client";

import { useState } from "react";
import AddressFields from "./AddressFields";

type Identity = { name?: string | null; phone?: string | null; alternatePhone?: string | null; email?: string | null; aadharNumber?: string | null };
type Address = { addressLine?: string | null; mandal?: string | null; district?: string | null; state?: string | null; country?: string | null; postalCode?: string | null };

export default function ContactPersonFields({
  showIdentityFields = true,
  defaults,
  addressDefaults,
  defaultSameAsSchool = true,
}: {
  /** false when the name/phone/email are already known from elsewhere (e.g. converting a lead — those come from the lead record, not re-typed here). */
  showIdentityFields?: boolean;
  defaults?: Identity;
  addressDefaults?: Address;
  defaultSameAsSchool?: boolean;
}) {
  const [sameAsSchool, setSameAsSchool] = useState(defaultSameAsSchool);

  return (
    <>
      {showIdentityFields && (
        <>
          <label className="field">
            Contact name
            <input className="in" name="contactName" defaultValue={defaults?.name ?? ""} placeholder="e.g. Anil Kumar" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field">
              Phone
              <input className="in mono" name="contactPhone" defaultValue={defaults?.phone ?? ""} placeholder="+91 90000 00000" />
            </label>
            <label className="field">
              Email
              <input className="in" type="email" name="contactEmail" defaultValue={defaults?.email ?? ""} placeholder="anil@school.edu.in" />
            </label>
          </div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          Alternate phone
          <input className="in mono" name="contactAlternatePhone" defaultValue={defaults?.alternatePhone ?? ""} placeholder="Optional" />
        </label>
        <label className="field">
          Aadhar number
          <input className="in mono" name="contactAadharNumber" maxLength={14} defaultValue={defaults?.aadharNumber ?? ""} placeholder="12-digit number" />
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--muted)", fontWeight: 500, cursor: "pointer" }}>
        <input type="checkbox" name="sameAsSchoolAddress" defaultChecked={defaultSameAsSchool} onChange={(e) => setSameAsSchool(e.target.checked)} />
        Contact address is the same as the school&apos;s registered address
      </label>
      {!sameAsSchool && <AddressFields prefix="contact" defaults={addressDefaults} />}
    </>
  );
}
