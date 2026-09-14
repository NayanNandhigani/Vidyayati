"use client";

import { useState, useTransition } from "react";
import { updateFeeSettings } from "./depth-actions";

export default function FeeSettingsPanel({
  showLateFine,
  showGst,
  latePerDay,
  lateGraceDays,
  gstNumber,
  gstRatePercent,
}: {
  showLateFine: boolean;
  showGst: boolean;
  latePerDay: number | null;
  lateGraceDays: number | null;
  gstNumber: string | null;
  gstRatePercent: number | null;
}) {
  const [, startTransition] = useTransition();
  const [perDay, setPerDay] = useState(latePerDay?.toString() ?? "");
  const [grace, setGrace] = useState(lateGraceDays?.toString() ?? "");
  const [gstNo, setGstNo] = useState(gstNumber ?? "");
  const [gstRate, setGstRate] = useState(gstRatePercent?.toString() ?? "");

  function save() {
    startTransition(() =>
      updateFeeSettings(perDay ? Number(perDay) : null, grace ? Number(grace) : null, gstNo, gstRate ? Number(gstRate) : null)
    );
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      {showLateFine && (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)" }}>
            Late fine ₹
            <input className="in" type="number" min={0} value={perDay} onChange={(e) => setPerDay(e.target.value)} onBlur={save} style={{ width: 50, fontSize: 11.5, padding: "3px 6px" }} />
            /day after
            <input className="in" type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11.5, padding: "3px 6px" }} />
            grace days
          </label>
        </>
      )}
      {showGst && (
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)" }}>
          GSTIN
          <input className="in" value={gstNo} onChange={(e) => setGstNo(e.target.value)} onBlur={save} placeholder="22AAAAA0000A1Z5" style={{ width: 130, fontSize: 11.5, padding: "3px 6px" }} />
          Rate
          <input className="in" type="number" min={0} max={100} value={gstRate} onChange={(e) => setGstRate(e.target.value)} onBlur={save} style={{ width: 44, fontSize: 11.5, padding: "3px 6px" }} />%
        </label>
      )}
    </div>
  );
}
