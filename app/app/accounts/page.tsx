import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { formatINR, formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/feature-flags";
import AddTransactionPanel from "./AddTransactionPanel";
import AccountsDepthPanel from "./AccountsDepthPanel";

const AUTO_SOURCE_LABEL: Record<string, string> = {
  AUTO_FEES: "Fee payment",
  AUTO_PAYROLL: "Payroll",
  AUTO_LIBRARY_FINE: "Library fine",
  AUTO_INVENTORY_PURCHASE: "Inventory purchase",
};

export default async function AccountsPage() {
  const accessLevel = await requireModuleAccess("Accounts", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const session = await auth();
  const sdb = await getScopedDb();

  const [showChartOfAccounts, showApprovals] = await Promise.all([
    hasFeature(session!.user.schoolId, "accounts.chartOfAccounts"),
    hasFeature(session!.user.schoolId, "accounts.approvals"),
  ]);

  // Pending-approval rows are held out of every total/balance/report below
  // — they only count once approved. For schools without the feature this
  // filters nothing, since approvalStatus never leaves "NONE".
  const transactions = await sdb.accountsTransaction.findMany({ where: { approvalStatus: { not: "PENDING" } }, orderBy: { date: "asc" } });
  const pendingTransactions = showApprovals ? await sdb.accountsTransaction.findMany({ where: { approvalStatus: "PENDING" }, orderBy: { date: "desc" } }) : [];
  const accountHeads = showChartOfAccounts ? await sdb.schoolAccountHead.findMany({ orderBy: { name: "asc" } }) : [];
  const school = showApprovals ? await sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { accountsApprovalThreshold: true } }) : null;

  let running = 0;
  const withBalance = transactions.map((t) => {
    running += t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    return { ...t, balance: running };
  });
  const balance = running;
  const ledger = [...withBalance].reverse().slice(0, 40);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const incomeMonth = transactions.filter((t) => t.type === "INCOME" && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
  const expenseMonth = transactions.filter((t) => t.type === "EXPENSE" && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
  const net = incomeMonth - expenseMonth;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), year: d.getFullYear(), month: d.getMonth() };
  });
  const monthlyFlow = months.map(({ label, year, month }) => {
    const inMonth = transactions.filter((t) => t.date.getFullYear() === year && t.date.getMonth() === month);
    return {
      label,
      income: inMonth.filter((t) => t.type === "INCOME").reduce((s, t) => s + Number(t.amount), 0),
      expense: inMonth.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + Number(t.amount), 0),
    };
  });
  const maxFlow = Math.max(1, ...monthlyFlow.flatMap((m) => [m.income, m.expense]));

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div>
        <div className="disp" style={{ fontSize: 21 }}>
          Accounts
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>Simple cash flow — income and expenses in one place, no double-entry bookkeeping · {formatDate(new Date())}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Income this month" value={formatINR(incomeMonth)} color="var(--teal)" />
        <Stat label="Expense this month" value={formatINR(expenseMonth)} color="var(--clay)" />
        <Stat label="Net this month" value={`${net >= 0 ? "+" : ""}${formatINR(net)}`} color={net >= 0 ? "var(--good)" : "var(--clay)"} />
        <Stat label="Cash balance" value={formatINR(balance)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.9fr 0.9fr", gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
          <div className="card" style={{ padding: 20, flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Income vs. expense</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--muted)" }}>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--teal)", marginRight: 5 }} />
                  Income
                </span>
                <span>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--clay)", marginRight: 5 }} />
                  Expense
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>Last 6 months, in ₹</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 26, height: 170, borderBottom: "1px solid var(--line)", paddingBottom: 2 }}>
              {monthlyFlow.map((m) => (
                <div key={m.label} style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 5, height: "100%" }}>
                  <div style={{ flex: 1, height: `${Math.max(2, (m.income / maxFlow) * 100)}%`, background: "var(--teal)", borderRadius: "3px 3px 0 0" }} />
                  <div style={{ flex: 1, height: `${Math.max(2, (m.expense / maxFlow) * 100)}%`, background: "var(--clay)", borderRadius: "3px 3px 0 0" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 10.5, color: "var(--faint)" }}>
              {monthlyFlow.map((m) => (
                <span key={m.label} style={{ flex: 1, textAlign: "center" }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 10px" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Transaction ledger</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)" }}>Auto-synced rows are locked — edit them from Fees or Payroll</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "56px 2fr 78px 168px 92px 108px", borderTop: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 20px" }}>
              <div>Date</div>
              <div>Description</div>
              <div>Category</div>
              <div>Source</div>
              <div style={{ textAlign: "right" }}>Amount</div>
              <div style={{ textAlign: "right" }}>Balance</div>
            </div>
            <div style={{ overflowY: "auto" }}>
              {ledger.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No transactions recorded yet.</div>}
              {ledger.map((t) => (
                <div key={t.id} style={{ display: "grid", gridTemplateColumns: "56px 2fr 78px 168px 92px 108px", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
                  <div className="mono" style={{ color: "var(--faint)" }}>
                    {t.date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                  <div>{t.description}</div>
                  <div style={{ color: "var(--muted)" }}>{t.category ?? "—"}</div>
                  <div>
                    {t.source === "MANUAL" ? (
                      <span style={{ color: "var(--faint)", fontWeight: 600, fontSize: 11.5 }}>Manual</span>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: "#EDEFF4", color: "var(--ink2)" }}>
                        Auto: {AUTO_SOURCE_LABEL[t.source] ?? "Payroll"}
                      </span>
                    )}
                  </div>
                  <div className="mono" style={{ textAlign: "right", fontWeight: 600, color: t.type === "INCOME" ? "var(--teal)" : "var(--clay)" }}>
                    {t.type === "INCOME" ? "+" : "−"}
                    {formatINR(Number(t.amount))}
                  </div>
                  <div className="mono" style={{ textAlign: "right", fontWeight: 600 }}>
                    {formatINR(t.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0, overflowY: "auto" }}>
          {canEdit && <AddTransactionPanel />}
          {canEdit && (showChartOfAccounts || showApprovals) && (
            <AccountsDepthPanel
              showChartOfAccounts={showChartOfAccounts}
              showApprovals={showApprovals}
              accountHeads={accountHeads.map((h) => ({ id: h.id, name: h.name, type: h.type }))}
              pendingTransactions={pendingTransactions.map((t) => ({ id: t.id, date: t.date.toISOString(), description: t.description, amount: Number(t.amount), type: t.type }))}
              approvalThreshold={school?.accountsApprovalThreshold ? Number(school.accountsApprovalThreshold) : null}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "15px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div className="mono" style={{ fontSize: 23, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
