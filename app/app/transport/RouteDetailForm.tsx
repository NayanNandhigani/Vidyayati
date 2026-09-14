"use client";

import { useState, useTransition } from "react";
import { updateRouteVehicleAndFee } from "./actions";

export default function RouteDetailForm({ routeId, vehicleId, feeAmount, vehicles }: { routeId: string; vehicleId: string | null; feeAmount: number | null; vehicles: { id: string; vehicleNo: string }[] }) {
  const [, startTransition] = useTransition();
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleId ?? "");
  const [fee, setFee] = useState(feeAmount?.toString() ?? "");

  function save(nextVehicle: string, nextFee: string) {
    startTransition(() => updateRouteVehicleAndFee(routeId, nextVehicle || null, nextFee ? Number(nextFee) : null));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 320 }}>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)" }}>
        Vehicle
        <select
          className="in"
          value={selectedVehicle}
          onChange={(e) => {
            setSelectedVehicle(e.target.value);
            save(e.target.value, fee);
          }}
          style={{ width: 170, fontSize: 11.5 }}
        >
          <option value="">Not assigned</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.vehicleNo}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--muted)" }}>
        Transport fee (₹/term)
        <input className="in mono" type="number" value={fee} onChange={(e) => setFee(e.target.value)} onBlur={() => save(selectedVehicle, fee)} style={{ width: 90, fontSize: 11.5 }} />
      </label>
    </div>
  );
}
