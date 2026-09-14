"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/format";
import { IconFileText } from "@/components/icons";
import { markContractSent, markContractSigned, cancelContract, type FormState } from "./actions";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "var(--line)", fg: "var(--faint)", label: "Draft" },
  SENT: { bg: "var(--info-tint)", fg: "var(--info)", label: "Sent for signature" },
  SIGNED: { bg: "var(--good-tint)", fg: "var(--good)", label: "Signed" },
  CANCELLED: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Cancelled" },
};

export type ContractRow = {
  id: string;
  contractNumber: string;
  schoolName: string;
  billingCycle: string;
  annualFee: number;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  signatoryName: string | null;
  signatoryTitle: string | null;
  signedDate: string | null;
};

const signInitial: FormState = {};

export default function ContractDetail({ contract, canManage }: { contract: ContractRow; canManage: boolean }) {
  const [status, setStatus] = useState(contract.status);
  const [pending, startTransition] = useTransition();
  const [showSignForm, setShowSignForm] = useState(false);
  const [signState, signAction, signPending] = useActionState(markContractSigned, signInitial);
  const style = STATUS_STYLE[status];

  function send() {
    startTransition(async () => {
      await markContractSent(contract.id);
      setStatus("SENT");
    });
  }

  function cancel() {
    if (!confirm("Cancel this contract? This can't be undone.")) return;
    startTransition(async () => {
      await cancelContract(contract.id);
      setStatus("CANCELLED");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>{contract.schoolName}</div>
            <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
              {contract.contractNumber}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{formatINR(contract.annualFee)}/yr</div>
        </div>
        <Link href="/super-admin/contracts" style={{ cursor: "pointer", color: "var(--muted)", fontSize: 17, textDecoration: "none" }}>
          ×
        </Link>
      </div>

      <div style={{ marginTop: 10 }}>
        <span className="pill" style={{ background: style.bg, color: style.fg }}>
          {style.label}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", marginTop: 14 }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <DetailRow label="Billing cycle" value={contract.billingCycle[0] + contract.billingCycle.slice(1).toLowerCase()} />
          <DetailRow label="Term start" value={new Date(contract.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} mono />
          <DetailRow label="Term end" value={new Date(contract.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} mono />
          {contract.signedDate && <DetailRow label="Signed on" value={new Date(contract.signedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} mono />}
          {contract.signatoryName && <DetailRow label="Signed by" value={`${contract.signatoryName}${contract.signatoryTitle ? `, ${contract.signatoryTitle}` : ""}`} last />}
        </div>

        {canManage && status !== "CANCELLED" && status !== "SIGNED" && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {status === "DRAFT" && (
              <button onClick={send} disabled={pending} style={{ background: "var(--info-tint)", color: "var(--info)", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
                Mark as sent for signature
              </button>
            )}

            {!showSignForm ? (
              <button onClick={() => setShowSignForm(true)} style={{ background: "var(--good-tint)", color: "var(--good)", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Record signature
              </button>
            ) : (
              <form action={signAction} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="hidden" name="contractId" value={contract.id} />
                <label className="field">
                  Signed by
                  <input className="in" name="signatoryName" required placeholder="Full name" />
                </label>
                <label className="field">
                  Title
                  <input className="in" name="signatoryTitle" placeholder="Principal / Trustee" />
                </label>
                <label className="field">
                  Date signed
                  <input className="in mono" type="date" name="signedDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
                {signState.error && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--critical)" }}>{signState.error}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={signPending} style={{ flex: 1, background: "var(--good)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: signPending ? "default" : "pointer" }}>
                    {signPending ? "Saving…" : "Confirm signed"}
                  </button>
                  <button type="button" onClick={() => setShowSignForm(false)} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <button onClick={cancel} disabled={pending} style={{ background: "none", color: "var(--critical)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "9px 0", fontSize: 12.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
              Cancel this contract
            </button>
          </div>
        )}
      </div>

      <Link
        href={`/super-admin/contracts/${contract.id}/print`}
        target="_blank"
        style={{ marginTop: 12, textAlign: "center", background: "var(--ink2)", borderRadius: 8, padding: 10, fontSize: 12.5, fontWeight: 700, color: "#fff", textDecoration: "none", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        <IconFileText style={{ width: 15, height: 15 }} />
        Open printable / downloadable copy
      </Link>
    </div>
  );
}

function DetailRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingBottom: last ? 0 : 6, borderBottom: last ? undefined : "1px solid var(--line)" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={mono ? "mono" : undefined} style={{ color: "var(--ink)", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}
