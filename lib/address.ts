// Shared by School's own address, SalesLead's address, and SchoolContact's
// address — all three use the same structured breakdown (street, Mandal,
// district, state, country, postal code). Kept in one place so the
// FormData-parsing shape doesn't drift between the three server actions
// that read it.

export type AddressFields = {
  addressLine: string | null;
  mandal: string | null;
  district: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Reads the unprefixed address fields — a School's or SalesLead's own address. */
export function readAddress(formData: FormData): AddressFields {
  return {
    addressLine: str(formData, "addressLine"),
    mandal: str(formData, "mandal"),
    district: str(formData, "district"),
    state: str(formData, "state"),
    country: str(formData, "country") ?? "India",
    postalCode: str(formData, "postalCode"),
  };
}

/** Reads the "contact"-prefixed address fields — a SchoolContact's own address. */
export function readContactAddress(formData: FormData): AddressFields {
  return {
    addressLine: str(formData, "contactAddressLine"),
    mandal: str(formData, "contactMandal"),
    district: str(formData, "contactDistrict"),
    state: str(formData, "contactState"),
    country: str(formData, "contactCountry") ?? "India",
    postalCode: str(formData, "contactPostalCode"),
  };
}

export function isAddressEmpty(a: AddressFields): boolean {
  return !a.addressLine && !a.mandal && !a.district && !a.state && !a.postalCode;
}

/** Formats an address into a single readable line for display — null if there's nothing to show. */
export function formatAddress(a: { addressLine?: string | null; mandal?: string | null; district?: string | null; state?: string | null; country?: string | null; postalCode?: string | null }): string | null {
  const parts = [a.addressLine, a.mandal, a.district, a.state, a.postalCode, a.country].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(", ") : null;
}
