"use client";

import { useState, useTransition } from "react";
import { createAccountHead, deleteAccountHead, updateAccountsApprovalThreshold, actOnTransactionApproval, getIncomeExpenditureReport } from "./depth-actions";
import type { AccountHeadType, TxnType } from "@prisma/client";

type Head = { id: string; name: string; type: AccountHeadType };
type PendingTxn = { id: string; date: string; description: string; amount: number; type: TxnType };
type ReportRow = { label: string; income: number; expense: number };

function formatINR(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function AccountsDepthPanel({
  showChartOfAccounts,
  showApprovals,
  accountHeads,
  pendingTransactions,
  approvalThreshold,
}: {
  showChartOfAccounts: boolean;
  showApprovals: boolean;
  accountHeads: Head[];
  pendingTransactions: PendingTxn[];
  approvalThreshold: number | null;
}) {
  const [, startTransition] = useTransition();
  const [headName, setHeadName] = useState("");
  const [headType, setHeadType] = useState<AccountHeadType>("EXPENSE" as AccountHeadType);
  const [threshold, setThreshold] = useState(approvalThreshold?.toString() ?? "");
  const [report, setReport] = useState<{ rows: ReportRow[]; totalIncome: number; totalExpense: number; net: number } | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  function addHead() {
    if (!headName.trim()) return;
    startTransition(() => createAccountHead(headName, headType));
    setHeadName("");
  }

  function saveThreshold() {
    startTransition(() => updateAccountsApprovalThreshold(threshold ? Number(threshold) : null));
  }

  function loadReport() {
    setLoadingReport(true);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    getIncomeExpenditureReport(from, to).then((r) => {
      setReport(r);
      setLoadingReport(false);
    });
  }

  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      {showApprovals && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
            Approval threshold
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 10 }}>
            Transactions ≥ ₹
            <input className="in" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} onBlur={saveThreshold} style={{ width: 90, fontSize: 12 }} />
            need a second admin's approval
          </label>
          {pendingTransactions.length > 0 && (
            <div>
              <div style={{ fontSize: 11.5, color: "var(--warn)", fontWeight: 700, marginBottom: 6 }}>{pendingTransactions.length} pending approval</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingTransactions.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "6px 10px", background: "var(--warn-tint)", borderRadius: 6 }}>
                    <span>{t.description} — {formatINR(t.amount)}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      <span onClick={() => startTransition(() => actOnTransactionApproval(t.id, true))} style={{ color: "var(--good)", fontWeight: 700, cursor: "pointer" }}>
                        Approve
                      </span>
                      <span onClick={() => startTransition(() => actOnTransactionApproval(t.id, false))} style={{ color: "var(--critical)", fontWeight: 700, cursor: "pointer" }}>
                        Reject
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showChartOfAccounts && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>
            Chart of accounts
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {accountHeads.map((h) => (
              <span key={h.id} className="pill" style={{ background: "var(--paper)", border: "1px solid var(--line)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
                {h.name} <span style={{ color: "var(--faint)" }}>({h.type.toLowerCase()})</span>
                <span onClick={() => startTransition(() => deleteAccountHead(h.id))} style={{ cursor: "pointer", color: "var(--critical)" }}>×</span>
              </span>
            ))}
            {accountHeads.length === 0 && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>No account heads yet.</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input className="in" placeholder="e.g. Utilities" value={headName} onChange={(e) => setHeadName(e.target.value)} style={{ fontSize: 11.5, flex: 1, padding: "4px 8px" }} />
            <select value={headType} onChange={(e) => setHeadType(e.target.value as AccountHeadType)} style={{ fontSize: 11.5, padding: "4px 6px" }}>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
            </select>
            <button type="button" onClick={addHead} style={{ fontSize: 11.5, fontWeight: 700, background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
              Add
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
            {!report ? (
              <span onClick={loadReport} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                {loadingReport ? "Loading…" : "View Income & Expenditure (this month) →"}
              </span>
            ) : (
              <div>
                <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Income & Expenditure — this month</div>
                {report.rows.map((r) => (
                  <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, fontSize: 11.5, padding: "3px 0" }}>
                    <span>{r.label}</span>
                    <span className="mono" style={{ color: "var(--good)" }}>{r.income > 0 ? formatINR(r.income) : ""}</span>
                    <span className="mono" style={{ color: "var(--critical)" }}>{r.expense > 0 ? formatINR(r.expense) : ""}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 12, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                  <span>Net</span>
                  <span className="mono" style={{ color: report.net >= 0 ? "var(--good)" : "var(--critical)" }}>{formatINR(report.net)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
