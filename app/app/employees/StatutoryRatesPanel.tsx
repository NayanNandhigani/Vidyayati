"use client";

import { useState, useTransition } from "react";
import { updateStatutoryRates } from "./payroll-depth-actions";

export default function StatutoryRatesPanel({
  pfPercent,
  esiPercent,
  ptFixedAmount,
  tdsPercent,
}: {
  pfPercent: number | null;
  esiPercent: number | null;
  ptFixedAmount: number | null;
  tdsPercent: number | null;
}) {
  const [, startTransition] = useTransition();
  const [pf, setPf] = useState(pfPercent?.toString() ?? "");
  const [esi, setEsi] = useState(esiPercent?.toString() ?? "");
  const [pt, setPt] = useState(ptFixedAmount?.toString() ?? "");
  const [tds, setTds] = useState(tdsPercent?.toString() ?? "");

  function save() {
    startTransition(() => updateStatutoryRates(pf ? Number(pf) : null, esi ? Number(esi) : null, pt ? Number(pt) : null, tds ? Number(tds) : null));
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--muted)" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
        PF <input className="in" type="number" value={pf} onChange={(e) => setPf(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11, padding: "3px 4px" }} />%
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
        ESI <input className="in" type="number" value={esi} onChange={(e) => setEsi(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11, padding: "3px 4px" }} />%
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
        PT ₹<input className="in" type="number" value={pt} onChange={(e) => setPt(e.target.value)} onBlur={save} style={{ width: 50, fontSize: 11, padding: "3px 4px" }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 3 }}>
        TDS <input className="in" type="number" value={tds} onChange={(e) => setTds(e.target.value)} onBlur={save} style={{ width: 40, fontSize: 11, padding: "3px 4px" }} />%
      </label>
    </div>
  );
}
