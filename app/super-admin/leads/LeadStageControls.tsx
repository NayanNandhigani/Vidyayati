"use client";

import { useActionState, useState, useTransition } from "react";
import { advanceStage, markLeadLost, type FormState } from "./actions";

const STAGE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  NEW: { bg: "var(--info-tint)", fg: "var(--info)", label: "New" },
  CONTACTED: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)", label: "Contacted" },
  DEMO_SCHEDULED: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "Demo Scheduled" },
  DEMO_DONE: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "Demo Done" },
  PROPOSAL_SENT: { bg: "var(--clay-tint)", fg: "var(--clay)", label: "Proposal Sent" },
  NEGOTIATION: { bg: "var(--clay-tint)", fg: "var(--clay)", label: "Negotiation" },
  WON: { bg: "var(--good-tint)", fg: "var(--good)", label: "Won" },
  LOST: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Lost" },
};

const CAN_ADVANCE = new Set(["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_DONE", "PROPOSAL_SENT", "NEGOTIATION"]);
const CAN_LOSE = new Set(["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_DONE", "PROPOSAL_SENT", "NEGOTIATION"]);

const lostInitial: FormState = {};

export default function LeadStageControls({ leadId, stage, canEdit }: { leadId: string; stage: string; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostState, lostAction, lostPending] = useActionState(markLeadLost, lostInitial);
  const style = STAGE_STYLE[stage];

  function move() {
    startTransition(async () => {
      await advanceStage(leadId);
    });
  }

  return (
    <div>
      <span className="pill" style={{ background: style.bg, color: style.fg, fontSize: 13 }}>
        {style.label}
      </span>

      {canEdit && (CAN_ADVANCE.has(stage) || CAN_LOSE.has(stage)) && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {CAN_ADVANCE.has(stage) && (
            <button onClick={move} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
              Move to next stage →
            </button>
          )}
          {CAN_LOSE.has(stage) && !showLostForm && (
            <button onClick={() => setShowLostForm(true)} style={{ background: "none", color: "var(--critical)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Mark lost
            </button>
          )}
        </div>
      )}

      {showLostForm && (
        <form action={lostAction} style={{ marginTop: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
          <input type="hidden" name="leadId" value={leadId} />
          <label className="field">
            Reason (optional)
            <input className="in" name="reason" placeholder="e.g. Went with a competitor" />
          </label>
          {lostState.error && <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--critical)" }}>{lostState.error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={lostPending} style={{ flex: 1, background: "var(--critical)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: lostPending ? "default" : "pointer" }}>
              {lostPending ? "Saving…" : "Confirm lost"}
            </button>
            <button type="button" onClick={() => setShowLostForm(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
