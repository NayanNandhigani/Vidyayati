"use client";

import { useState, useTransition } from "react";
import { updateStudentChargedFee } from "../actions";

export default function StudentFeeAllocationPanel({
  studentId,
  actualFee,
  chargedFee,
  isAdmin,
}: {
  studentId: string;
  actualFee: number | null;
  chargedFee: number | null;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [charged, setCharged] = useState(chargedFee != null ? String(chargedFee) : "");
  const [error, setError] = useState<string | null>(null);

  const scholarship = actualFee != null && chargedFee != null ? actualFee - chargedFee : null;

  function save() {
    const newCharged = charged ? Number(charged) : null;
    if (newCharged != null && actualFee != null && newCharged > actualFee) {
      setError("Charged fee can't be more than the actual fee.");
      return;
    }
    setError(null);
    if (newCharged !== chargedFee && !confirm("This changes this student's recorded scholarship (actual fee − charged fee). Continue?")) {
      return;
    }
    startTransition(async () => {
      try {
        await updateStudentChargedFee(studentId, newCharged);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16, background: "var(--paper)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editing ? 12 : 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Fee allocation &amp; scholarship</div>
        {isAdmin && !editing && (
          <span onClick={() => setEditing(true)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
            Edit charged fee
          </span>
        )}
      </div>

      {!editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
          <StatBox label="Actual fee" value={actualFee != null ? `₹${actualFee.toLocaleString("en-IN")}` : "Not set in Fee Structure"} />
          <StatBox label="Charged fee" value={chargedFee != null ? `₹${chargedFee.toLocaleString("en-IN")}` : "—"} />
          <StatBox label="Scholarship" value={scholarship != null ? `₹${scholarship.toLocaleString("en-IN")}` : "—"} color="var(--good)" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            Actual fee (from Academic Management → Fee Structure): <span className="mono" style={{ fontWeight: 700, color: "var(--ink)" }}>{actualFee != null ? `₹${actualFee.toLocaleString("en-IN")}` : "Not set"}</span>
          </div>
          <label className="field">
            Charged fee (₹)
            <input className="in mono" type="number" min={0} value={charged} onChange={(e) => setCharged(e.target.value)} style={{ maxWidth: 200 }} />
          </label>
          {error && <div style={{ color: "var(--critical)", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: pending ? "default" : "pointer" }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setCharged(chargedFee != null ? String(chargedFee) : "");
                setError(null);
              }}
              style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--card)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
