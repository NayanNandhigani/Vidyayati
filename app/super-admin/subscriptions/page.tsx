import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import SubscriptionsView from "./SubscriptionsView";

export default async function SubscriptionsPage() {
  const now = new Date();
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);

  const invoices = await db.subscriptionInvoice.findMany({
    include: { school: true, payments: { orderBy: { paidOn: "desc" } } },
    orderBy: { dueDate: "asc" },
  });

  const rows = invoices.map((inv) => ({
    invoiceId: inv.id,
    schoolId: inv.schoolId,
    schoolName: inv.school.name,
    billingPeriod: inv.billingPeriod,
    amount: Number(inv.amount),
    paidAmount: inv.payments.reduce((s, p) => s + Number(p.amount), 0),
    status: inv.status,
    dueDate: inv.dueDate.toISOString(),
    lastPaymentDate: inv.payments[0]?.paidOn.toISOString() ?? null,
  }));

  const revenueThisFY = await db.subscriptionPayment.findMany({ where: { paidOn: { gte: fyStart } }, select: { amount: true } });
  const collected = revenueThisFY.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = rows.filter((r) => r.status !== "PAID").reduce((s, r) => s + Math.max(0, r.amount - r.paidAmount), 0);
  const activeSchools = await db.school.count({ where: { status: "ACTIVE" } });

  // ARR projection: each live school's most recent invoice amount, annualized —
  // real invoice history rather than a flat plan-tier guess.
  const recurringSchools = await db.school.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true } });
  const latestInvoicePerSchool = await db.subscriptionInvoice.findMany({
    where: { schoolId: { in: recurringSchools.map((s) => s.id) } },
    orderBy: { createdAt: "desc" },
    distinct: ["schoolId"],
    select: { amount: true },
  });
  const arr = latestInvoicePerSchool.reduce((s, inv) => s + Number(inv.amount), 0);

  const overdueSchools = rows.filter((r) => r.status !== "PAID" && new Date(r.dueDate) < now);

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Subscriptions &amp; Billing
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Schools' subscription payments to Vidya Yati</div>
        </div>
        <Link href="/super-admin/subscriptions/new" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          + Create invoice
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <Stat label="Revenue collected — this FY" value={formatINR(collected)} color="var(--marigold-deep)" />
        <Stat label="Outstanding / overdue" value={formatINR(outstanding)} color="var(--critical)" critBg />
        <Stat label="Active subscriptions" value={activeSchools} color="var(--good)" />
        <Stat label="Annual recurring (projected)" value={formatINR(arr)} color="var(--teal)" />
      </div>

      {overdueSchools.length > 0 && (
        <div style={{ background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 10, padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 13.5, color: "var(--critical)" }}>
            <b>
              {overdueSchools.length} school{overdueSchools.length === 1 ? "" : "s"}
            </b>{" "}
            {overdueSchools.length === 1 ? "is" : "are"} overdue on payment —{" "}
            {overdueSchools
              .slice(0, 2)
              .map((r) => `${r.schoolName} (${formatINR(r.amount - r.paidAmount)})`)
              .join(", ")}
            {overdueSchools.length > 2 ? ` and ${overdueSchools.length - 2} more` : ""}.
          </div>
        </div>
      )}

      <SubscriptionsView rows={rows} />
    </div>
  );
}

function Stat({ label, value, color, critBg }: { label: string; value: React.ReactNode; color?: string; critBg?: boolean }) {
  return (
    <div className="card" style={{ padding: "16px 18px", ...(critBg ? { borderColor: "var(--critical-border)", background: "var(--critical-tint)" } : {}) }}>
      <div style={{ fontSize: 12, color: critBg ? "var(--critical)" : "var(--muted)", marginBottom: 8, fontWeight: critBg ? 600 : 400 }}>{label}</div>
      <div className="mono" style={{ fontSize: 25, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
