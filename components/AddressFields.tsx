// Plain field group, no interactivity of its own — safe to drop into any
// "use client" form (OnboardForm, ConvertLeadForm, NewLeadForm, and the two
// School edit forms) without needing "use client" itself. `prefix="contact"`
// switches to the contact-person address field names (see lib/address.ts's
// readAddress/readContactAddress, which this must stay in sync with).
type Props = {
  prefix?: "" | "contact";
  defaults?: {
    addressLine?: string | null;
    mandal?: string | null;
    district?: string | null;
    state?: string | null;
    country?: string | null;
    postalCode?: string | null;
  };
};

export default function AddressFields({ prefix = "", defaults }: Props) {
  const name = (suffix: "AddressLine" | "Mandal" | "District" | "State" | "Country" | "PostalCode") =>
    prefix ? `${prefix}${suffix}` : suffix.charAt(0).toLowerCase() + suffix.slice(1);

  return (
    <>
      <label className="field">
        Street address
        <input className="in" name={name("AddressLine")} defaultValue={defaults?.addressLine ?? ""} placeholder="e.g. 14 MG Road" />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          Mandal
          <input className="in" name={name("Mandal")} defaultValue={defaults?.mandal ?? ""} placeholder="e.g. Serilingampally" />
        </label>
        <label className="field">
          District
          <input className="in" name={name("District")} defaultValue={defaults?.district ?? ""} placeholder="e.g. Rangareddy" />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field">
          State
          <input className="in" name={name("State")} defaultValue={defaults?.state ?? ""} placeholder="e.g. Telangana" />
        </label>
        <label className="field">
          Postal code
          <input className="in mono" name={name("PostalCode")} defaultValue={defaults?.postalCode ?? ""} placeholder="e.g. 500019" />
        </label>
      </div>
      <label className="field">
        Country
        <input className="in" name={name("Country")} defaultValue={defaults?.country ?? "India"} />
      </label>
    </>
  );
}
