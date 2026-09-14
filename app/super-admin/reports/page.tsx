import Link from "next/link";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/format";
import { requirePlatformModuleAccess } from "@/lib/permissions";

export default async function SuperAdminReportsPage() {
  await requirePlatformModuleAccess("Reports", "VIEW");

  const now = new Date();
  const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1);

  const [schools, students, invoices, contracts, ledgerEntriesFY, vendors, staffUsers, loginsLast30d, moduleUsageRaw, staffCounts, schoolGroups] = await Promise.all([
    db.school.findMany(),
    db.student.groupBy({ by: ["schoolId"], where: { status: "ACTIVE" }, _count: true }),
    db.subscriptionInvoice.findMany({ include: { payments: true, school: true } }),
    db.contract.findMany({ select: { status: true } }),
    db.ledgerEntry.findMany({ where: { date: { gte: fyStart } }, select: { entryType: true, amount: true, vendorId: true } }),
    db.vendor.findMany({ select: { id: true, name: true } }),
    db.user.findMany({ where: { schoolId: null, role: { in: ["SUPER_ADMIN", "PLATFORM_STAFF"] } }, select: { role: true, status: true } }),
    db.activityLog.count({ where: { type: "LOGIN", occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    db.activityLog.groupBy({ by: ["module"], where: { type: "PAGE_VIEW", module: { not: null }, occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, _count: true }),
    db.staffProfile.groupBy({ by: ["schoolId"], _count: true }),
    db.schoolGroup.findMany({ include: { schools: true }, orderBy: { name: "asc" } }),
  ]);

  const statusCounts = { ACTIVE: 0, TRIAL: 0, EXPIRING: 0, OVERDUE: 0, CANCELLED: 0 } as Record<string, number>;
  for (const s of schools) statusCounts[s.status]++;

  const salesStageCounts: Record<string, number> = { LEAD: 0, DEMO_SCHEDULED: 0, PROPOSAL_SENT: 0, NEGOTIATION: 0, WON: 0 };
  for (const s of schools) salesStageCounts[s.salesStage]++;
  const pipelineTotal = schools.length - salesStageCounts.WON;
  const conversionPct = schools.length ? Math.round((salesStageCounts.WON / schools.length) * 100) : 0;

  const totalStudents = students.reduce((s, x) => s + x._count, 0);

  const monthStarts = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), year: d.getFullYear(), month: d.getMonth() };
  });
  const onboardedByMonth = monthStarts.map(({ label, year, month }) => ({
    label,
    count: schools.filter((s) => s.onboardedOn.getFullYear() === year && s.onboardedOn.getMonth() === month).length,
  }));
  const maxOnboard = Math.max(1, ...onboardedByMonth.map((m) => m.count));

  const topSchools = [...schools]
    .map((s) => ({ school: s, count: students.find((x) => x.schoolId === s.id)?._count ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const totalBilled = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalCollected = invoices.reduce((s, i) => s + i.payments.reduce((sum, p) => sum + Number(p.amount), 0), 0);
  const collectionRate = totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0;
  const overdueAmount = invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + (Number(i.amount) - i.payments.reduce((sum, p) => sum + Number(p.amount), 0)), 0);

  const contractCounts = { DRAFT: 0, SENT: 0, SIGNED: 0, CANCELLED: 0 } as Record<string, number>;
  for (const c of contracts) contractCounts[c.status]++;

  const incomeFY = ledgerEntriesFY.filter((e) => e.entryType === "INCOME").reduce((s, e) => s + Number(e.amount), 0);
  const expenseFY = ledgerEntriesFY.filter((e) => e.entryType === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0);
  const netFY = incomeFY - expenseFY;

  const vendorSpend = vendors
    .map((v) => ({ name: v.name, total: ledgerEntriesFY.filter((e) => e.vendorId === v.id && e.entryType === "EXPENSE").reduce((s, e) => s + Number(e.amount), 0) }))
    .filter((v) => v.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const superAdminCount = staffUsers.filter((u) => u.role === "SUPER_ADMIN").length;
  const platformStaffActive = staffUsers.filter((u) => u.role === "PLATFORM_STAFF" && u.status === "ACTIVE").length;

  const topModules = moduleUsageRaw
    .map((g) => ({ module: g.module as string, count: g._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Multi-branch rollup (Batch 16) — aggregates each SchoolGroup's member
  // schools. Purely a read of existing per-school data (students/staff/
  // billing), grouped differently; doesn't touch any school's own records.
  const billedBySchool = new Map<string, number>();
  const collectedBySchool = new Map<string, number>();
  for (const i of invoices) {
    billedBySchool.set(i.schoolId, (billedBySchool.get(i.schoolId) ?? 0) + Number(i.amount));
    const paid = i.payments.reduce((s, p) => s + Number(p.amount), 0);
    collectedBySchool.set(i.schoolId, (collectedBySchool.get(i.schoolId) ?? 0) + paid);
  }
  const groupRollup = schoolGroups.map((g) => {
    const memberIds = new Set(g.schools.map((s) => s.id));
    const totalStudents = students.filter((s) => memberIds.has(s.schoolId)).reduce((s, x) => s + x._count, 0);
    const totalStaff = staffCounts.filter((s) => memberIds.has(s.schoolId)).reduce((s, x) => s + x._count, 0);
    const totalBilled = g.schools.reduce((s, sc) => s + (billedBySchool.get(sc.id) ?? 0), 0);
    const totalCollected = g.schools.reduce((s, sc) => s + (collectedBySchool.get(sc.id) ?? 0), 0);
    return { id: g.id, name: g.name, schoolCount: g.schools.length, totalStudents, totalStaff, totalBilled, totalCollected };
  });

  const reportCards = [
    { key: "schools", title: "School Status & Plan Mix", desc: "Active, trial, expiring & overdue schools", color: "var(--teal)", tint: "var(--teal-tint)", stat: `${statusCounts.ACTIVE} active`, href: "/super-admin/schools" },
    { key: "pipeline", title: "Sales Pipeline", desc: "Lead-to-onboarded conversion funnel", color: "var(--marigold-deep)", tint: "var(--marigold-tint)", stat: `${conversionPct}% conversion`, href: "/super-admin/schools" },
    { key: "billing", title: "Billing Collection", desc: "Invoiced vs collected across all schools", color: "var(--good)", tint: "var(--good-tint)", stat: `${collectionRate}% collected`, href: "/super-admin/subscriptions" },
    { key: "overdue", title: "Overdue Invoices", desc: "Outstanding subscription payments", color: "var(--critical)", tint: "var(--critical-tint)", stat: formatINR(overdueAmount), href: "/super-admin/subscriptions" },
    { key: "accounts", title: "Platform Accounts P&L", desc: "Vidya Yati's own income vs expense, this FY", color: "var(--info)", tint: "var(--info-tint)", stat: formatINR(netFY), href: "/super-admin/accounts" },
    { key: "vendors", title: "Vendor Spend", desc: "Top vendors by spend, this FY", color: "var(--clay)", tint: "var(--clay-tint)", stat: vendorSpend[0] ? `${vendorSpend[0].name} · ${formatINR(vendorSpend[0].total)}` : "No spend yet", href: "/super-admin/accounts" },
    { key: "contracts", title: "Contracts", desc: "Draft, sent, signed & cancelled agreements", color: "var(--marigold-deep)", tint: "var(--marigold-tint)", stat: `${contractCounts.SIGNED} signed`, href: "/super-admin/contracts" },
    { key: "staff", title: "Platform Staff & Access", desc: "Team headcount and account status", color: "var(--teal)", tint: "var(--teal-tint)", stat: `${superAdminCount + platformStaffActive} active`, href: "/super-admin/staff" },
    { key: "engagement", title: "Platform Engagement", desc: "Logins & most-used modules, last 30 days", color: "var(--good)", tint: "var(--good-tint)", stat: `${loginsLast30d} logins`, href: "/super-admin/schools" },
  ];

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, minHeight: "100dvh", boxSizing: "border-box" }}>
      <div>
        <div className="disp" style={{ fontSize: 22 }}>
          Platform reports
        </div>
        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 2 }}>Every report you can run across Schools, Billing, Accounts, Contracts and Staff</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <Stat label="Total schools" value={schools.length} />
        <Stat label="Students platform-wide" value={totalStudents.toLocaleString("en-IN")} />
        <Stat label="Billing collection rate" value={`${collectionRate}%`} color="var(--marigold-deep)" />
        <Stat label="Billed vs collected" value={`${formatINR(totalCollected)} / ${formatINR(totalBilled)}`} color="var(--teal)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18 }}>
        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Schools onboarded</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Last 12 months</div>
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 2, minHeight: 110 }}>
            {onboardedByMonth.map((m, i) => (
              <div key={i} style={{ flex: 1, height: `${Math.max(3, (m.count / maxOnboard) * 100)}%`, background: "var(--teal-tint)", borderRadius: "3px 3px 0 0", position: "relative" }}>
                <span className="mono" style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 10.5, color: "var(--faint)" }}>
                  {m.count > 0 ? m.count : ""}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5, color: "var(--faint)" }}>
            {onboardedByMonth.map((m, i) => (
              <span key={i}>{m.label}</span>
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} style={{ fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>{status[0] + status.slice(1).toLowerCase()}</span> <span className="mono" style={{ fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "20px 0 10px" }}>Sales pipeline</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {(["LEAD", "DEMO_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION", "WON"] as const).map((stage) => (
              <div key={stage} style={{ fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>{stage.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span> <span className="mono" style={{ fontWeight: 700 }}>{salesStageCounts[stage]}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 6 }}>
            {pipelineTotal} in pipeline · {conversionPct}% of all school records have converted to onboarded
          </div>
        </div>

        <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Largest schools by enrolment</div>
          <div style={{ overflowY: "auto", flex: 1, maxHeight: 280 }}>
            {topSchools.map(({ school, count }) => (
              <div key={school.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{school.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--faint)" }}>{school.city}</div>
                </div>
                <span className="mono" style={{ fontWeight: 700 }}>{count}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "18px 0 10px" }}>Most-used modules, last 30 days</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topModules.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No module activity recorded yet.</div>
            ) : (
              topModules.map((m) => (
                <div key={m.module} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--muted)" }}>{m.module}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{m.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>All reports</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {reportCards.map((r) => (
            <Link key={r.key} href={r.href} className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: r.tint, flex: "none" }} />
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{r.desc}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: r.color, marginTop: "auto" }}>
                {r.stat}
              </div>
              <div style={{ fontSize: 11, color: "var(--marigold-deep)", fontWeight: 600, marginTop: 6 }}>View details →</div>
            </Link>
          ))}
        </div>
      </div>

      {groupRollup.length > 0 && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Multi-branch rollup</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 14 }}>
            Aggregated across each branch group's member schools — assign a school to a group from its Schools detail page, under "Branch group" (requires the "Multi-branch group rollup" feature to be enabled for that school).
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.9fr 0.9fr 1fr 1fr", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <div>Group</div>
            <div>Schools</div>
            <div>Students</div>
            <div>Staff</div>
            <div>Billed</div>
            <div>Collected</div>
          </div>
          {groupRollup.map((g) => (
            <div key={g.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr 0.9fr 0.9fr 1fr 1fr", padding: "11px 0", borderBottom: "1px solid var(--line)", fontSize: 13, alignItems: "center" }}>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div className="mono">{g.schoolCount}</div>
              <div className="mono">{g.totalStudents.toLocaleString("en-IN")}</div>
              <div className="mono">{g.totalStaff.toLocaleString("en-IN")}</div>
              <div className="mono">{formatINR(g.totalBilled)}</div>
              <div className="mono" style={{ color: "var(--good)" }}>{formatINR(g.totalCollected)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
