"use client";

import { useState, useTransition } from "react";
import { updateHomeworkGraceDays } from "./depth-actions";

export default function GraceDaysSetting({ graceDays }: { graceDays: number | null }) {
  const [, startTransition] = useTransition();
  const [days, setDays] = useState(graceDays?.toString() ?? "");

  function save() {
    startTransition(() => updateHomeworkGraceDays(days ? Number(days) : null));
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
      Grace period
      <input className="in" type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} onBlur={save} style={{ width: 46, fontSize: 12, padding: "4px 6px" }} />
      days before marking late
    </label>
  );
}
