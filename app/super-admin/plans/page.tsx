import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import NewPlanForm from "./NewPlanForm";
import PlanActiveToggle from "./PlanActiveToggle";

export default async function PlansPage() {
  await requirePlatformModuleAccess("Plans", "VIEW");

  const plans = await db.subscriptionPlan.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { invoices: true } } },
  });

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div>
        <div className="disp" style={{ fontSize: 22 }}>
          Plans
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>What Vidya Yati charges for — referenced by subscription invoices</div>
      </div>

      <div className="card" style={{ padding: 22, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <NewPlanForm />

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 0.8fr", fontSize: 11, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
          <div>Plan</div>
          <div>Billing cycle</div>
          <div>Price</div>
          <div>Invoices issued</div>
          <div>Status</div>
        </div>

        {plans.length === 0 && <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>No plans yet — add one above.</div>}

        {plans.map((p) => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 0.8fr", alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ color: "var(--muted)" }}>{p.billingCycle === "ANNUAL" ? "Annual" : "Monthly"}</div>
            <div className="mono" style={{ color: "var(--muted)" }}>
              {formatINR(Number(p.price))}
            </div>
            <div className="mono" style={{ color: "var(--muted)" }}>
              {p._count.invoices}
            </div>
            <div>
              <PlanActiveToggle planId={p.id} isActive={p.isActive} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
