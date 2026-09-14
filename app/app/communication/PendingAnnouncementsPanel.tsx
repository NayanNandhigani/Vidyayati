"use client";

import { useTransition } from "react";
import { approveAnnouncement, rejectAnnouncement } from "./actions";

const AUDIENCE_LABEL: Record<string, string> = {
  ALL_PARENTS: "All Parents",
  ALL_STAFF: "All Staff",
  SPECIFIC_CLASS: "Specific Class",
  SPECIFIC_STUDENT: "Specific Student",
};

export type PendingAnnouncement = { id: string; title: string; body: string; audienceType: string; createdAt: string };

export function PendingAnnouncementsPanel({ items, isAdmin }: { items: PendingAnnouncement[]; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>Awaiting School Admin approval</div>
        <span className="pill" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
          {items.length} pending
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</span>
                <span className="pill" style={{ background: "var(--info-tint)", color: "var(--info)", fontSize: 10.5 }}>
                  {AUDIENCE_LABEL[a.audienceType] ?? a.audienceType}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, maxWidth: 460 }}>{a.body}</div>
            </div>
            {isAdmin ? (
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => approveAnnouncement(a.id))}
                  style={{ background: "var(--good)", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => rejectAnnouncement(a.id))}
                  style={{ background: "var(--card)", border: "1px solid var(--critical)", color: "var(--critical)", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}
                >
                  Reject
                </button>
              </div>
            ) : (
              <span className="pill" style={{ background: "var(--warn-tint)", color: "var(--warn)", flex: "none" }}>
                Awaiting approval
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
