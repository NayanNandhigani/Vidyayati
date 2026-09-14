"use client";

import { useState, useTransition } from "react";
import type { MealType } from "@prisma/client";
import { logMealServed, deleteMealServed } from "./meal-actions";

const MEALS = ["BREAKFAST", "LUNCH", "DINNER"] as const;
const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" };

export type MealServedRow = { id: string; date: string; mealType: MealType; description: string; headcount: number | null };

export function MealsServedLog({ logs }: { logs: MealServedRow[] }) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mealType, setMealType] = useState<MealType>("BREAKFAST");
  const [description, setDescription] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!description.trim()) {
      setError("Describe what was served.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await logMealServed(date, mealType, description, headcount ? Number(headcount) : null);
        setDescription("");
        setHeadcount("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not log.");
      }
    });
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>Meals served today</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input className="in mono" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 12, width: 130 }} />
        <select className="in" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} style={{ fontSize: 12, width: "auto" }}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABEL[m]}
            </option>
          ))}
        </select>
        <input className="in mono" type="number" min={0} placeholder="Headcount" value={headcount} onChange={(e) => setHeadcount(e.target.value)} style={{ fontSize: 12, width: 90 }} />
      </div>
      <textarea className="in" rows={2} placeholder="What was served…" value={description} onChange={(e) => setDescription(e.target.value)} style={{ fontSize: 12.5 }} />
      {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
      <button type="button" onClick={submit} disabled={pending} style={{ fontSize: 13, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", cursor: pending ? "default" : "pointer" }}>
        {pending ? "Logging…" : "Log meal"}
      </button>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
        {logs.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12.5 }}>No meals logged yet.</div>}
        {logs.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: 12, padding: "8px 10px", background: "var(--paper)", borderRadius: 6 }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                {MEAL_LABEL[l.mealType]} <span className="mono" style={{ fontWeight: 500, color: "var(--faint)" }}>· {new Date(l.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
              </div>
              <div style={{ color: "var(--muted)", marginTop: 2 }}>{l.description}</div>
              {l.headcount != null && <div className="mono" style={{ color: "var(--faint)", fontSize: 10.5, marginTop: 2 }}>{l.headcount} served</div>}
            </div>
            <span onClick={() => startTransition(() => deleteMealServed(l.id))} style={{ color: "var(--critical)", cursor: "pointer", fontWeight: 700 }}>
              ×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
