"use client";

import { useState, useTransition } from "react";
import { createVehicle, updateVehicle, type VehicleFields } from "./vehicle-actions";

export type VehicleRow = VehicleFields & {
  id: string;
  isActive: boolean;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastLocationAt: string | null;
  routeNames: string[];
};

const EMPTY: VehicleFields = {
  vehicleNo: "",
  vehicleType: "",
  capacity: null,
  make: "",
  model: "",
  driverName: "",
  driverPhone: "",
  driverLicenseNo: "",
  driverLicenseExpiry: "",
  insurancePolicyNo: "",
  insuranceExpiry: "",
  fitnessExpiry: "",
  pollutionCertExpiry: "",
  notes: "",
} as unknown as VehicleFields;

function Field({ children }: { children: React.ReactNode }) {
  return <label className="field">{children}</label>;
}

function toFormFields(f: Partial<VehicleFields>): VehicleFields {
  return {
    vehicleNo: f.vehicleNo ?? "",
    vehicleType: f.vehicleType ?? "",
    capacity: f.capacity ?? null,
    make: f.make ?? "",
    model: f.model ?? "",
    driverName: f.driverName ?? "",
    driverPhone: f.driverPhone ?? "",
    driverLicenseNo: f.driverLicenseNo ?? "",
    driverLicenseExpiry: f.driverLicenseExpiry?.slice(0, 10) ?? "",
    insurancePolicyNo: f.insurancePolicyNo ?? "",
    insuranceExpiry: f.insuranceExpiry?.slice(0, 10) ?? "",
    fitnessExpiry: f.fitnessExpiry?.slice(0, 10) ?? "",
    pollutionCertExpiry: f.pollutionCertExpiry?.slice(0, 10) ?? "",
    notes: f.notes ?? "",
  } as VehicleFields;
}

export function VehicleForm({ vehicle, onSaved }: { vehicle: VehicleRow | null; onSaved?: (id?: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<VehicleFields>(vehicle ? toFormFields(vehicle) : EMPTY);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof VehicleFields>(key: K, value: VehicleFields[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.vehicleNo.trim()) {
      setError("Vehicle number is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (vehicle) {
          await updateVehicle(vehicle.id, form);
          onSaved?.();
        } else {
          const created = await createVehicle(form);
          setForm(EMPTY);
          onSaved?.(created.id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vehicle</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Vehicle no. (registration)
          <input className="in mono" value={form.vehicleNo} onChange={(e) => set("vehicleNo", e.target.value as never)} placeholder="TS 11 EF 1029" />
        </Field>
        <Field>
          Type
          <input className="in" value={form.vehicleType ?? ""} onChange={(e) => set("vehicleType", e.target.value as never)} placeholder="Bus / Van / Mini Bus" />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Capacity (seats)
          <input className="in mono" type="number" min={0} value={form.capacity ?? ""} onChange={(e) => set("capacity", (e.target.value ? Number(e.target.value) : null) as never)} placeholder="45" />
        </Field>
        <Field>
          Make
          <input className="in" value={form.make ?? ""} onChange={(e) => set("make", e.target.value as never)} placeholder="Tata" />
        </Field>
        <Field>
          Model
          <input className="in" value={form.model ?? ""} onChange={(e) => set("model", e.target.value as never)} placeholder="Starbus" />
        </Field>
      </div>

      <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Driver</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field>
          Driver name
          <input className="in" value={form.driverName ?? ""} onChange={(e) => set("driverName", e.target.value as never)} placeholder="Ramesh Yadav" />
        </Field>
        <Field>
          Driver phone
          <input className="in mono" value={form.driverPhone ?? ""} onChange={(e) => set("driverPhone", e.target.value as never)} placeholder="98765xxxxx" />
        </Field>
        <Field>
          License no.
          <input className="in mono" value={form.driverLicenseNo ?? ""} onChange={(e) => set("driverLicenseNo", e.target.value as never)} />
        </Field>
      </div>
      <Field>
        License expiry
        <input className="in mono" type="date" value={form.driverLicenseExpiry ?? ""} onChange={(e) => set("driverLicenseExpiry", e.target.value as never)} style={{ maxWidth: 180 }} />
      </Field>

      <div style={{ fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 4 }}>Compliance</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field>
          Insurance policy no.
          <input className="in mono" value={form.insurancePolicyNo ?? ""} onChange={(e) => set("insurancePolicyNo", e.target.value as never)} />
        </Field>
        <Field>
          Insurance expiry
          <input className="in mono" type="date" value={form.insuranceExpiry ?? ""} onChange={(e) => set("insuranceExpiry", e.target.value as never)} />
        </Field>
        <Field>
          Fitness cert. expiry
          <input className="in mono" type="date" value={form.fitnessExpiry ?? ""} onChange={(e) => set("fitnessExpiry", e.target.value as never)} />
        </Field>
        <Field>
          Pollution cert. expiry
          <input className="in mono" type="date" value={form.pollutionCertExpiry ?? ""} onChange={(e) => set("pollutionCertExpiry", e.target.value as never)} />
        </Field>
      </div>
      {vehicle && (
        <Field>
          Notes
          <textarea className="in" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value as never)} />
        </Field>
      )}

      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
      <button type="button" onClick={submit} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
        {pending ? "Saving…" : vehicle ? "Save changes" : "Add vehicle"}
      </button>
    </div>
  );
}
