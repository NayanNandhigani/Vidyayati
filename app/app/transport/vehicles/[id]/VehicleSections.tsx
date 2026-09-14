"use client";

import { useState, useTransition } from "react";
import type { VehicleLogType } from "@prisma/client";
import { IconTruck, IconClipboard, IconPaperclip, IconAward } from "@/components/icons";
import { VehicleForm, type VehicleRow } from "../../VehiclesPanel";
import { toggleVehicleActive, updateVehicleLocation, addVehicleLog, deleteVehicleLog, addVehicleDocument, deleteVehicleDocument } from "../../vehicle-actions";
import PersonDocumentsPanel, { type PersonDocumentRow } from "@/components/PersonDocumentsPanel";

type LogRow = { id: string; type: VehicleLogType; date: string; description: string; cost: number | null; odometerReading: number | null };

const LOG_TYPE_LABEL: Record<VehicleLogType, string> = { SERVICE: "Service", INSURANCE_RENEWAL: "Insurance renewal", OTHER: "Other" };

function expiryStyle(dateStr: string | null): { color: string; label: string } | null {
  if (!dateStr) return null;
  const days = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  if (days < 0) return { color: "var(--critical)", label: "Expired" };
  if (days <= 30) return { color: "var(--warn)", label: `${Math.ceil(days)}d left` };
  return { color: "var(--good)", label: "Valid" };
}

const SECTIONS = [
  { key: "details", label: "Vehicle details", icon: IconTruck },
  { key: "service", label: "Service log", icon: IconClipboard },
  { key: "documents", label: "Documents", icon: IconPaperclip },
  { key: "insurance", label: "Insurance", icon: IconAward },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

export default function VehicleSections({
  vehicle,
  logs,
  documents,
  canEdit,
}: {
  vehicle: VehicleRow;
  logs: LogRow[];
  documents: PersonDocumentRow[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [section, setSection] = useState<SectionKey>("details");
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="card" style={{ padding: 22 }}>
        <VehicleForm vehicle={vehicle} onSaved={() => setEditing(false)} />
        <span onClick={() => setEditing(false)} style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
          Cancel
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.key;
            return (
              <button
                key={s.key}
                type="button"
                title={s.label}
                aria-label={s.label}
                onClick={() => setSection(s.key)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: active ? "1px solid var(--marigold)" : "1px solid var(--line)",
                  background: active ? "var(--marigold-tint)" : "var(--card)",
                  color: active ? "var(--marigold-deep)" : "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Icon width={18} height={18} />
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span
            onClick={() => canEdit && startTransition(() => toggleVehicleActive(vehicle.id))}
            className="pill"
            style={{ background: vehicle.isActive ? "var(--good-tint)" : "var(--critical-tint)", color: vehicle.isActive ? "var(--good)" : "var(--critical)", cursor: canEdit ? "pointer" : "default" }}
          >
            {vehicle.isActive ? "Active" : "Inactive"}
          </span>
          {canEdit && (
            <span onClick={() => setEditing(true)} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
              Edit
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 22, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {section === "details" && <DetailsSection vehicle={vehicle} pending={pending} startTransition={startTransition} />}
        {section === "service" && <ServiceLogSection vehicleId={vehicle.id} logs={logs} pending={pending} startTransition={startTransition} />}
        {section === "documents" && (
          <div>
            <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Policy documents</div>
            <PersonDocumentsPanel
              documents={documents}
              redirectPath={`/app/transport/vehicles/${vehicle.id}`}
              onUpload={(category, formData) => addVehicleDocument(vehicle.id, category, formData)}
              onDelete={deleteVehicleDocument}
              assetUrlBase="/api/vehicle-documents"
            />
          </div>
        )}
        {section === "insurance" && <InsuranceSection vehicle={vehicle} />}
      </div>
    </div>
  );
}

function DetailsSection({ vehicle, pending, startTransition }: { vehicle: VehicleRow; pending: boolean; startTransition: React.TransitionStartFunction }) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  function postLocation() {
    if (!lat || !lng) return;
    startTransition(() => updateVehicleLocation(vehicle.id, Number(lat), Number(lng)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {vehicle.routeNames.length > 0 && <div style={{ fontSize: 12, color: "var(--teal)" }}>Serving: {vehicle.routeNames.join(", ")}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        <MiniStat label="Type" value={vehicle.vehicleType ?? "—"} sub={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || undefined} />
        <MiniStat label="Capacity" value={vehicle.capacity ? `${vehicle.capacity} seats` : "—"} />
        <MiniStat label="Driver" value={vehicle.driverName ?? "—"} sub={vehicle.driverPhone ?? undefined} />
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Live location (manual ping)</div>
        {vehicle.lastKnownLat != null ? (
          <div style={{ fontSize: 12.5, marginBottom: 8 }}>
            <a href={`https://www.google.com/maps?q=${vehicle.lastKnownLat},${vehicle.lastKnownLng}`} target="_blank" rel="noreferrer" style={{ color: "var(--marigold-deep)", fontWeight: 700 }}>
              Open last known position ↗
            </a>
            <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Updated {vehicle.lastLocationAt ? new Date(vehicle.lastLocationAt).toLocaleString("en-IN") : "—"}</div>
          </div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 8 }}>No location posted yet.</div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <input className="in mono" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} style={{ fontSize: 11.5, width: 100 }} />
          <input className="in mono" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} style={{ fontSize: 11.5, width: 100 }} />
          <button type="button" onClick={postLocation} disabled={pending} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>
            Post location
          </button>
        </div>
      </div>

      {vehicle.notes && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Notes</div>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>{vehicle.notes}</div>
        </div>
      )}
    </div>
  );
}

function ServiceLogSection({ vehicleId, logs, pending, startTransition }: { vehicleId: string; logs: LogRow[]; pending: boolean; startTransition: React.TransitionStartFunction }) {
  const [logType, setLogType] = useState<VehicleLogType>("SERVICE");
  const [logDate, setLogDate] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logCost, setLogCost] = useState("");
  const [logOdo, setLogOdo] = useState("");

  function submitLog() {
    if (!logDate || !logDesc.trim()) return;
    startTransition(async () => {
      await addVehicleLog(vehicleId, logType, logDate, logDesc, logCost ? Number(logCost) : null, logOdo ? Number(logOdo) : null);
      setLogDate("");
      setLogDesc("");
      setLogCost("");
      setLogOdo("");
    });
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Service &amp; insurance log</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <select className="in" value={logType} onChange={(e) => setLogType(e.target.value as VehicleLogType)} style={{ fontSize: 11.5, width: "auto" }}>
          {(Object.keys(LOG_TYPE_LABEL) as VehicleLogType[]).map((t) => (
            <option key={t} value={t}>
              {LOG_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <input className="in mono" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} style={{ fontSize: 11.5, width: 130 }} />
        <input className="in" placeholder="Description" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} style={{ fontSize: 11.5, flex: 1, minWidth: 120 }} />
        <input className="in mono" type="number" placeholder="Cost ₹" value={logCost} onChange={(e) => setLogCost(e.target.value)} style={{ fontSize: 11.5, width: 80 }} />
        <input className="in mono" type="number" placeholder="Odometer" value={logOdo} onChange={(e) => setLogOdo(e.target.value)} style={{ fontSize: 11.5, width: 90 }} />
        <button type="button" onClick={submitLog} disabled={pending} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", cursor: "pointer" }}>
          Log
        </button>
      </div>
      {logs.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No log entries yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {logs.map((l) => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center", fontSize: 12, padding: "6px 10px", background: "var(--paper)", borderRadius: 6 }}>
              <span className="pill" style={{ background: "var(--card)", border: "1px solid var(--line)", fontSize: 10 }}>
                {LOG_TYPE_LABEL[l.type]}
              </span>
              <span>
                {l.description}
                {l.odometerReading != null && <span className="mono" style={{ color: "var(--faint)" }}> · {l.odometerReading} km</span>}
              </span>
              <span className="mono" style={{ color: "var(--muted)" }}>
                {l.cost != null ? `₹${l.cost.toLocaleString("en-IN")}` : ""}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                  {new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </span>
                <span onClick={() => startTransition(() => deleteVehicleLog(l.id, vehicleId))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
                  ×
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsuranceSection({ vehicle }: { vehicle: VehicleRow }) {
  const insuranceStyle = expiryStyle(vehicle.insuranceExpiry);
  const fitnessStyle = expiryStyle(vehicle.fitnessExpiry);
  const pollutionStyle = expiryStyle(vehicle.pollutionCertExpiry);
  const licenseStyle = expiryStyle(vehicle.driverLicenseExpiry);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Compliance status</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        <ComplianceRow label="Insurance" policyNo={vehicle.insurancePolicyNo} expiry={vehicle.insuranceExpiry} style={insuranceStyle} />
        <ComplianceRow label="Fitness certificate" expiry={vehicle.fitnessExpiry} style={fitnessStyle} />
        <ComplianceRow label="Pollution certificate" expiry={vehicle.pollutionCertExpiry} style={pollutionStyle} />
        <ComplianceRow label="Driver's license" policyNo={vehicle.driverLicenseNo} expiry={vehicle.driverLicenseExpiry} style={licenseStyle} />
      </div>
    </div>
  );
}

function ComplianceRow({ label, policyNo, expiry, style }: { label: string; policyNo?: string | null; expiry: string | null; style: { color: string; label: string } | null }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</div>
        {style && (
          <span className="pill" style={{ background: `color-mix(in srgb, ${style.color} 15%, transparent)`, color: style.color }}>
            {style.label}
          </span>
        )}
      </div>
      {policyNo !== undefined && <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{policyNo || "No policy/license no. on file"}</div>}
      <div className="mono" style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
        {expiry ? `Expires ${new Date(expiry).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : "No expiry date on file"}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 8, padding: "9px 11px" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>{sub}</div>}
    </div>
  );
}
