import Link from "next/link";
import type { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { formatINR, formatDate } from "@/lib/format";
import PlatformUsageChart from "./PlatformUsageChart";
import RevenueTrendChart from "./RevenueTrendChart";
import SalesPipelineFunnel from "./SalesPipelineFunnel";
import LeadsFunnel from "./LeadsFunnel";
import AccountHealthPanel, { type SchoolHealth } from "./AccountHealthPanel";
import AttentionList, { type AttentionRow } from "./AttentionList";

// Live operational dashboard — never statically cache these numbers.
export const dynamic = "force-dynamic";

type Period = "day" | "month" | "year";
const SCHOOL_ROLES: UserRole[] = ["SCHOOL_ADMIN", "STAFF", "PARENT"];

function periodRange(period: Period, now: Date): { start: Date; end: Date; label: string } {
  if (period === "day") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end, label: "today" };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    return { start, end, label: "this year" };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, label: "this month" };
}

function daysAgo(n: number, from: Date) {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

function computeHealth(lastLogin: Date | null, activationRatio: number, now: Date): { tier: SchoolHealth["tier"]; reason: string } {
  const daysSinceLogin = lastLogin ? daysBetween(now, lastLogin) : Infinity;
  const pct = Math.round(activationRatio * 100);
  if (!lastLogin) return { tier: "red", reason: "No logins yet" };
  if (daysSinceLogin > 30) return { tier: "red", reason: `No login in ${daysSinceLogin} days` };
  if (activationRatio < 0.25) return { tier: "red", reason: `Only ${pct}% accounts activated` };
  if (daysSinceLogin > 14) return { tier: "amber", reason: `No login in ${daysSinceLogin} days` };
  if (activationRatio < 0.6) return { tier: "amber", reason: `${pct}% accounts activated` };
  return { tier: "green", reason: "Active and engaged" };
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: "var(--good-tint)", fg: "var(--good)", label: "Active" },
  TRIAL: { bg: "var(--info-tint)", fg: "var(--info)", label: "Trial" },
  EXPIRING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Expiring soon" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  CANCELLED: { bg: "var(--line)", fg: "var(--faint)", label: "Cancelled" },
};
const HEALTH_DOT: Record<SchoolHealth["tier"], string> = { green: "var(--good)", amber: "var(--warn)", red: "var(--critical)" };

export default async function SuperAdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams;
  const period: Period = params.period === "month" || params.period === "year" ? params.period : "day";

  const now = new Date();
  const { start, end, label: periodLabel } = periodRange(period, now);
  const in30Days = addDays(now, 30);
  const in14Days = addDays(now, 14);
  const in7Days = addDays(now, 7);
  const days365Ago = daysAgo(365, now);
  const days90Ago = daysAgo(90, now);

  const [
    activeCount,
    trialCount,
    expiringCount,
    overdueCount,
    cancelledCount,
    paymentsTTM,
    renewalInvoices30,
    renewalInvoices14,
    overdueInvoicesRaw,
    cohort90,
    pipelineRaw,
    leadStageRaw,
    allPayments,
    liveSchools,
    studentCounts,
    lastLoginBySchool,
    roleTotals,
    roleActive,
    trialInvoicesSoon,
    // Platform usage (existing engagement section)
    usageSchools,
    usageTotalsRaw,
    usageActiveRaw,
    platformTotal,
    platformActive,
  ] = await Promise.all([
    db.school.count({ where: { salesStage: "WON", status: "ACTIVE" } }),
    db.school.count({ where: { salesStage: "WON", status: "TRIAL" } }),
    db.school.count({ where: { salesStage: "WON", status: "EXPIRING" } }),
    db.school.count({ where: { salesStage: "WON", status: "OVERDUE" } }),
    db.school.count({ where: { salesStage: "WON", status: "CANCELLED" } }),
    db.subscriptionPayment.findMany({ where: { paidOn: { gte: days365Ago } }, select: { amount: true } }),
    db.subscriptionInvoice.findMany({ where: { dueDate: { gte: now, lte: in30Days }, status: { not: "PAID" } }, include: { school: true, payments: true } }),
    db.subscriptionInvoice.findMany({ where: { dueDate: { gte: now, lte: in14Days }, status: { not: "PAID" } }, include: { school: true, payments: true } }),
    db.subscriptionInvoice.findMany({ where: { dueDate: { lt: now }, status: { not: "PAID" } }, include: { school: true, payments: true } }),
    db.school.findMany({ where: { salesStage: "WON", onboardedOn: { gte: days90Ago } }, select: { status: true } }),
    db.school.groupBy({ by: ["salesStage"], _count: true }),
    db.salesLead.groupBy({ by: ["stage"], _count: true }),
    db.subscriptionPayment.findMany({ select: { amount: true, paidOn: true } }),
    db.school.findMany({ where: { salesStage: "WON", status: { not: "CANCELLED" } }, select: { id: true, name: true, city: true, status: true, relationshipManager: true, onboardedOn: true } }),
    db.student.groupBy({ by: ["schoolId"], where: { status: "ACTIVE" }, _count: true }),
    db.activityLog.groupBy({ by: ["schoolId"], where: { type: "LOGIN", schoolId: { not: null } }, _max: { occurredAt: true } }),
    db.user.groupBy({ by: ["schoolId"], where: { schoolId: { not: null }, role: { in: ["STAFF", "PARENT"] } }, _count: true }),
    db.user.groupBy({ by: ["schoolId"], where: { schoolId: { not: null }, role: { in: ["STAFF", "PARENT"] }, lastLoginAt: { not: null } }, _count: true }),
    db.subscriptionInvoice.findMany({ where: { dueDate: { lte: in7Days }, status: { not: "PAID" }, school: { status: "TRIAL" } }, include: { school: true } }),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.groupBy({ by: ["schoolId", "role"], where: { schoolId: { not: null }, role: { in: SCHOOL_ROLES } }, _count: true }),
    db.user.groupBy({
      by: ["schoolId", "role"],
      where: { schoolId: { not: null }, role: { in: SCHOOL_ROLES }, activityLogs: { some: { type: "LOGIN", occurredAt: { gte: start, lt: end } } } },
      _count: true,
    }),
    db.user.count({ where: { schoolId: { not: null }, role: { in: SCHOOL_ROLES } } }),
    db.user.count({ where: { schoolId: { not: null }, role: { in: SCHOOL_ROLES }, activityLogs: { some: { type: "LOGIN", occurredAt: { gte: start, lt: end } } } } }),
  ]);

  // --- KPIs ---------------------------------------------------------------
  const mrr = paymentsTTM.reduce((s, p) => s + Number(p.amount), 0) / 12;
  const renewalsDueValue = renewalInvoices30.reduce((s, i) => s + Math.max(0, Number(i.amount) - i.payments.reduce((p, x) => p + Number(x.amount), 0)), 0);
  const conversionPct = cohort90.length > 0 ? Math.round((cohort90.filter((s) => s.status === "ACTIVE").length / cohort90.length) * 100) : null;

  // --- Studentcount + activation/last-login maps (shared) -----------------
  const studentCountMap = new Map(studentCounts.map((s) => [s.schoolId, s._count]));
  const lastLoginMap = new Map(lastLoginBySchool.map((r) => [r.schoolId, r._max.occurredAt]));
  const roleTotalMap = new Map(roleTotals.map((r) => [r.schoolId, r._count]));
  const roleActiveMap = new Map(roleActive.map((r) => [r.schoolId, r._count]));

  const healthMap = new Map<string, SchoolHealth>();
  for (const s of liveSchools) {
    const total = roleTotalMap.get(s.id) ?? 0;
    const active = roleActiveMap.get(s.id) ?? 0;
    const ratio = total > 0 ? active / total : 0;
    const { tier, reason } = computeHealth(lastLoginMap.get(s.id) ?? null, ratio, now);
    healthMap.set(s.id, { schoolId: s.id, schoolName: s.name, tier, reason });
  }
  const healthList = Array.from(healthMap.values());

  // --- Attention list -------------------------------------------------------
  const attentionRows: AttentionRow[] = [];
  for (const inv of overdueInvoicesRaw) {
    const balance = Number(inv.amount) - inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const overdueDays = daysBetween(now, inv.dueDate);
    attentionRows.push({
      schoolId: inv.schoolId,
      schoolName: inv.school.name,
      category: "overdue",
      detail: `${formatINR(balance)} overdue, ${overdueDays} day${overdueDays === 1 ? "" : "s"} past due`,
      severity: "critical",
    });
  }
  for (const inv of renewalInvoices14) {
    const balance = Number(inv.amount) - inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const daysLeft = daysBetween(inv.dueDate, now) * -1;
    attentionRows.push({
      schoolId: inv.schoolId,
      schoolName: inv.school.name,
      category: "renewal_due",
      detail: `Renewal ${formatINR(balance)} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      severity: "warn",
    });
  }
  for (const inv of trialInvoicesSoon) {
    const total = roleTotalMap.get(inv.schoolId) ?? 0;
    const active = roleActiveMap.get(inv.schoolId) ?? 0;
    const ratio = total > 0 ? active / total : 0;
    if (ratio >= 0.4) continue; // healthy trials aren't a risk even if ending soon
    const daysLeft = daysBetween(inv.dueDate, now) * -1;
    attentionRows.push({
      schoolId: inv.schoolId,
      schoolName: inv.school.name,
      category: "low_activity_trial",
      detail: `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}, only ${Math.round(ratio * 100)}% activated`,
      severity: "critical",
    });
  }

  // --- Sales pipeline -------------------------------------------------------
  const pipelineCounts: Record<string, number> = {};
  pipelineRaw.forEach((r) => (pipelineCounts[r.salesStage] = r._count));

  const leadStageCounts: Record<string, number> = {};
  leadStageRaw.forEach((r) => (leadStageCounts[r.stage] = r._count));
  const leadLostCount = leadStageCounts.LOST ?? 0;

  // --- Revenue trend (last 12 months) ----------------------------------------
  const monthStarts = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), year: d.getFullYear(), month: d.getMonth() };
  });
  const monthlyRevenue = monthStarts.map(({ label, year, month }) => ({
    label,
    amount: allPayments.filter((p) => p.paidOn.getFullYear() === year && p.paidOn.getMonth() === month).reduce((s, p) => s + Number(p.amount), 0),
  }));

  // --- Platform usage (engagement) ---------------------------------------------
  const usageTotalMap = new Map(usageTotalsRaw.map((r) => [`${r.schoolId}:${r.role}`, r._count]));
  const usageActiveMap = new Map(usageActiveRaw.map((r) => [`${r.schoolId}:${r.role}`, r._count]));
  const usageData = usageSchools.map((s) => ({
    schoolId: s.id,
    schoolName: s.name,
    admin: { total: usageTotalMap.get(`${s.id}:SCHOOL_ADMIN`) ?? 0, active: usageActiveMap.get(`${s.id}:SCHOOL_ADMIN`) ?? 0 },
    staff: { total: usageTotalMap.get(`${s.id}:STAFF`) ?? 0, active: usageActiveMap.get(`${s.id}:STAFF`) ?? 0 },
    parent: { total: usageTotalMap.get(`${s.id}:PARENT`) ?? 0, active: usageActiveMap.get(`${s.id}:PARENT`) ?? 0 },
  }));
  const platformActivePct = platformTotal > 0 ? Math.round((platformActive / platformTotal) * 100) : 0;

  // --- Schools table preview ------------------------------------------------
  const schoolsPreview = [...liveSchools].sort((a, b) => b.onboardedOn.getTime() - a.onboardedOn.getTime()).slice(0, 8);

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="disp" style={{ fontSize: 22 }}>
            Platform overview
          </div>
          <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>{formatDate(now)}</div>
        </div>
        <Link href="/super-admin/schools" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          + Onboard a school
        </Link>
      </div>

      <div className="dash-grid-5" style={{ display: "grid", gap: 14, flex: "none" }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Schools by status</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
            <StatusChip label="Active" value={activeCount} color="var(--good)" />
            <StatusChip label="Trial" value={trialCount} color="var(--info)" />
            <StatusChip label="Expiring" value={expiringCount} color="var(--warn)" />
            <StatusChip label="Overdue" value={overdueCount} color="var(--critical)" />
            <StatusChip label="Cancelled" value={cancelledCount} color="var(--faint)" />
          </div>
        </div>
        <Stat label="MRR (trailing 12mo)" value={formatINR(mrr)} color="var(--marigold-deep)" />
        <Stat label="Renewals due in 30 days" value={`${renewalInvoices30.length} · ${formatINR(renewalsDueValue)}`} color="var(--warn)" />
        <Stat label="Trial → Paid conversion (90d)" value={conversionPct === null ? "—" : `${conversionPct}%`} color="var(--teal)" />
        <Stat label="Sales pipeline (open)" value={(pipelineCounts.LEAD ?? 0) + (pipelineCounts.DEMO_SCHEDULED ?? 0) + (pipelineCounts.PROPOSAL_SENT ?? 0) + (pipelineCounts.NEGOTIATION ?? 0)} color="var(--ink)" />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="card" style={{ padding: 20, flex: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Renewal &amp; risk attention {attentionRows.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({attentionRows.length})</span>}
          </div>
          <AttentionList rows={attentionRows} />
        </div>

        <div className="dash-grid-2" style={{ display: "grid", gap: 18, flex: "none" }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Sales pipeline</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Every school, by stage</div>
            <SalesPipelineFunnel counts={pipelineCounts} />
          </div>

          <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Account health</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Login recency + staff/parent activation, across every live school</div>
            <AccountHealthPanel schools={healthList} />
          </div>
        </div>

        <div className="dash-grid-2" style={{ display: "grid", gap: 18, flex: "none" }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Leads</div>
              <Link href="/super-admin/leads" style={{ fontSize: 11.5, color: "var(--marigold-deep)", fontWeight: 600, textDecoration: "none" }}>
                View board →
              </Link>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Prospective schools, by stage — separate from the onboarding pipeline above</div>
            <LeadsFunnel counts={leadStageCounts} lostCount={leadLostCount} />
          </div>
        </div>

        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", flex: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Revenue trend</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Collected, last 12 months</div>
          <RevenueTrendChart data={monthlyRevenue} />
        </div>

        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", height: 260, flex: "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Platform usage</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Accounts that have actually logged in — School Admin, Staff and Parent, per school
              </div>
            </div>
            <PeriodTabs current={period} />
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 6px" }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
              {platformActive.toLocaleString("en-IN")} / {platformTotal.toLocaleString("en-IN")}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              accounts active {periodLabel} ({platformActivePct}%)
            </span>
          </div>

          <PlatformUsageChart data={usageData} />
        </div>

        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Schools</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Showing {schoolsPreview.length} of {liveSchools.length} ·{" "}
              <Link href="/super-admin/schools" style={{ color: "var(--marigold-deep)", fontWeight: 600, textDecoration: "none" }}>
                View all
              </Link>
            </div>
          </div>
          {schoolsPreview.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No schools onboarded yet.</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 1fr 1.1fr 0.9fr", fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.04em", paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                <div>School</div>
                <div>Students</div>
                <div>Status</div>
                <div>Owner</div>
                <div>Health</div>
              </div>
              {schoolsPreview.map((s) => {
                const style = STATUS_STYLE[s.status];
                const health = healthMap.get(s.id);
                return (
                  <Link key={s.id} href={`/super-admin/schools/${s.id}`} style={{ display: "grid", gridTemplateColumns: "2fr 0.7fr 1fr 1.1fr 0.9fr", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5, textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    <div className="mono">{studentCountMap.get(s.id) ?? 0}</div>
                    <div>
                      <span className="pill" style={{ background: style.bg, color: style.fg }}>
                        {style.label}
                      </span>
                    </div>
                    <div style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.relationshipManager ?? "—"}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {health && <span style={{ width: 7, height: 7, borderRadius: "50%", background: HEALTH_DOT[health.tier], flex: "none" }} />}
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{health ? health.tier[0].toUpperCase() + health.tier.slice(1) : "—"}</span>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span className="mono" style={{ fontSize: 15, fontWeight: 700, color }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function PeriodTabs({ current }: { current: Period }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--paper)", borderRadius: 8, padding: 4, flex: "none" }}>
      {PERIOD_OPTIONS.map((o) => (
        <Link
          key={o.value}
          href={`/super-admin/dashboard?period=${o.value}`}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: current === o.value ? 700 : 500,
            color: current === o.value ? "var(--ink)" : "var(--muted)",
            background: current === o.value ? "var(--card)" : "transparent",
            textDecoration: "none",
            boxShadow: current === o.value ? "0 1px 2px rgba(0,0,0,.06)" : "none",
          }}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
