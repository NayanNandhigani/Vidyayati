"use client";

import { useActionState, useState, useTransition } from "react";
import { createGradeScale, setActiveGradeScale, createGradeBand, deleteGradeBand, type FormState } from "./actions";

type Band = { id: string; label: string; minPercent: number; maxPercent: number; remark: string | null };
type Scale = { id: string; name: string; isActive: boolean; bands: Band[] };

const initialState: FormState = {};

export default function GradingPanel({ scales }: { scales: Scale[] }) {
  const [showScaleForm, setShowScaleForm] = useState(false);
  const [showBandForm, setShowBandForm] = useState(false);
  const [scaleState, scaleAction, scalePending] = useActionState(createGradeScale, initialState);
  const [bandState, bandAction, bandPending] = useActionState(createGradeBand, initialState);
  const [, startTransition] = useTransition();

  const activeScale = scales.find((s) => s.isActive) ?? scales[0];

  function activate(id: string) {
    startTransition(async () => {
      await setActiveGradeScale(id);
    });
  }

  function removeBand(id: string) {
    startTransition(async () => {
      await deleteGradeBand(id);
    });
  }

  return (
    <div style={{ maxWidth: 640, width: "100%" }}>
      <div style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 2 }}>
          Grading
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Configure letter/grade-band scales (e.g. CBSE-style A1, A2, B1…) for report cards. Schools without one configured see a default A+/A/B+/B/C/D scale.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {scales.map((s) => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="pill" style={{ background: s.isActive ? "var(--good-tint)" : "var(--line)", color: s.isActive ? "var(--good)" : "var(--faint)" }}>
                {s.isActive ? "Active" : "Inactive"}
              </span>
              {!s.isActive && (
                <span onClick={() => activate(s.id)} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
                  Set as active
                </span>
              )}
            </div>
          </div>
        ))}
        {scales.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No grade scales configured yet.</div>}
      </div>

      {showScaleForm ? (
        <form action={scaleAction} style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--line)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <label className="field">
            Scale name
            <input className="in" name="name" placeholder="e.g. CBSE 10-point" required />
          </label>
          {scaleState.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{scaleState.error}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={scalePending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {scalePending ? "Adding…" : "Add scale"}
            </button>
            <span onClick={() => setShowScaleForm(false)} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", cursor: "pointer", padding: "8px 4px" }}>
              Cancel
            </span>
          </div>
        </form>
      ) : (
        <span onClick={() => setShowScaleForm(true)} style={{ display: "inline-block", marginBottom: 20, fontSize: 13, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
          + Add grade scale
        </span>
      )}

      {activeScale && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
            Bands — {activeScale.name}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {activeScale.bands.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No bands defined yet.</div>}
            {[...activeScale.bands].sort((a, b) => b.minPercent - a.minPercent).map((b) => (
              <div key={b.id} style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1.4fr auto", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--paper)", borderRadius: 8, fontSize: 12.5 }}>
                <span style={{ fontWeight: 700 }}>{b.label}</span>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  {b.minPercent}–{b.maxPercent}%
                </span>
                <span style={{ color: "var(--faint)" }}>{b.remark ?? "—"}</span>
                <span onClick={() => removeBand(b.id)} style={{ color: "var(--critical)", cursor: "pointer", fontSize: 11.5, fontWeight: 600 }}>
                  Remove
                </span>
              </div>
            ))}
          </div>

          {showBandForm ? (
            <form action={bandAction} style={{ display: "flex", flexDirection: "column", gap: 10, border: "1px solid var(--line)", borderRadius: 10, padding: 16 }}>
              <input type="hidden" name="scaleId" value={activeScale.id} />
              <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr 1.5fr", gap: 10 }}>
                <label className="field">
                  Label
                  <input className="in" name="label" placeholder="A1" required />
                </label>
                <label className="field">
                  Min %
                  <input className="in mono" type="number" name="minPercent" min={0} max={100} required />
                </label>
                <label className="field">
                  Max %
                  <input className="in mono" type="number" name="maxPercent" min={0} max={100} required />
                </label>
                <label className="field">
                  Remark
                  <input className="in" name="remark" placeholder="Outstanding" />
                </label>
              </div>
              {bandState.error && <div style={{ color: "var(--critical)", fontSize: 12.5 }}>{bandState.error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={bandPending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {bandPending ? "Adding…" : "Add band"}
                </button>
                <span onClick={() => setShowBandForm(false)} style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", cursor: "pointer", padding: "8px 4px" }}>
                  Cancel
                </span>
              </div>
            </form>
          ) : (
            <span onClick={() => setShowBandForm(true)} style={{ display: "inline-block", fontSize: 13, fontWeight: 600, color: "var(--marigold-deep)", cursor: "pointer" }}>
              + Add band
            </span>
          )}
        </div>
      )}
    </div>
  );
}
