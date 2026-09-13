import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import SchoolEditForm from "../SchoolEditForm";
import SchoolAddressForm from "../SchoolAddressForm";
import SchoolContactForm from "../SchoolContactForm";
import StatusForm from "../StatusForm";
import CapsForm from "../CapsForm";
import RelationshipManagerField from "../RelationshipManagerField";
import SchoolNotes from "../SchoolNotes";
import SchoolDocuments from "../SchoolDocuments";
import ModuleUsageChart from "../ModuleUsageChart";
import ModuleAccessGrid from "./ModuleAccessGrid";
import FeatureAccessGrid from "./FeatureAccessGrid";
import SchoolBillingPanel, { type SchoolInvoiceRow } from "./SchoolBillingPanel";
import AccessControlPanel from "./AccessControlPanel";
import SchoolGroupField from "./SchoolGroupField";
import SetupLinkBanner from "@/components/SetupLinkBanner";

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ACTIVE: { bg: "var(--good-tint)", fg: "var(--good)", label: "Active" },
  TRIAL: { bg: "var(--info-tint)", fg: "var(--info)", label: "Trial" },
  EXPIRING: { bg: "var(--warn-tint)", fg: "var(--warn)", label: "Expiring soon" },
  OVERDUE: { bg: "var(--critical-tint)", fg: "var(--critical)", label: "Overdue" },
  CANCELLED: { bg: "var(--line)", fg: "var(--faint)", label: "Cancelled" },
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function SchoolProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ setupToken?: string }> }) {
  const access = await requirePlatformModuleAccess("Schools", "VIEW");
  const canManage = access === "EDIT";
  const { id } = await params;
  const { setupToken } = await searchParams;

  const school = await db.school.findUnique({
    where: { id },
    include: { users: { where: { role: "SCHOOL_ADMIN" }, take: 1 }, contactPerson: true },
  });
  if (!school) notFound();

  const admin = school.users[0];
  const style = STATUS_STYLE[school.status];
  const since30d = new Date(Date.now() - THIRTY_DAYS_MS);

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    studentCount,
    staffCount,
    classCount,
    classGrades,
    parentCount,
    transportRouteCount,
    staffTotal,
    staffActivated,
    parentTotal,
    parentActivated,
    loginsToday,
    loginsWeek,
    loginsMonth,
    loginsYear,
    lastLoginAgg,
    moduleUsageRaw,
    notesRaw,
    documentsRaw,
    invoicesRaw,
    featureFlagsRaw,
    showSchoolGroups,
    schoolGroups,
  ] = await Promise.all([
    db.student.count({ where: { schoolId: id, status: "ACTIVE" } }),
    db.staffProfile.count({ where: { schoolId: id } }),
    db.class.count({ where: { schoolId: id } }),
    db.class.findMany({ where: { schoolId: id }, select: { grade: true }, distinct: ["grade"] }),
    db.parent.count({ where: { schoolId: id } }),
    db.transportRoute.count({ where: { schoolId: id } }),
    db.user.count({ where: { schoolId: id, role: "STAFF" } }),
    db.user.count({ where: { schoolId: id, role: "STAFF", lastLoginAt: { not: null } } }),
    db.user.count({ where: { schoolId: id, role: "PARENT" } }),
    db.user.count({ where: { schoolId: id, role: "PARENT", lastLoginAt: { not: null } } }),
    db.activityLog.findMany({ where: { schoolId: id, type: "LOGIN", occurredAt: { gte: startOfDay } }, select: { userId: true }, distinct: ["userId"] }),
    db.activityLog.findMany({ where: { schoolId: id, type: "LOGIN", occurredAt: { gte: startOfWeek } }, select: { userId: true }, distinct: ["userId"] }),
    db.activityLog.findMany({ where: { schoolId: id, type: "LOGIN", occurredAt: { gte: startOfMonth } }, select: { userId: true }, distinct: ["userId"] }),
    db.activityLog.findMany({ where: { schoolId: id, type: "LOGIN", occurredAt: { gte: startOfYear } }, select: { userId: true }, distinct: ["userId"] }),
    db.user.aggregate({ where: { schoolId: id }, _max: { lastLoginAt: true } }),
    db.activityLog.groupBy({ by: ["module"], where: { schoolId: id, type: "PAGE_VIEW", module: { not: null }, occurredAt: { gte: since30d } }, _count: true }),
    db.schoolNote.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true } } } }),
    db.schoolDocument.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, include: { uploadedBy: { select: { name: true } } } }),
    db.subscriptionInvoice.findMany({ where: { schoolId: id }, orderBy: { createdAt: "desc" }, include: { payments: true, plan: true } }),
    db.schoolFeatureFlag.findMany({ where: { schoolId: id, enabled: true }, select: { key: true } }),
    hasFeature(id, "admin.schoolGroups"),
    db.schoolGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  const enabledFeatureKeys = featureFlagsRaw.map((f) => f.key);

  const moduleUsage = moduleUsageRaw
    .map((g) => ({ module: g.module as string, count: g._count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const notes = notesRaw.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), authorName: n.author.name }));
  const documents = documentsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    createdAt: d.createdAt.toISOString(),
    uploadedByName: d.uploadedBy?.name ?? null,
  }));
  const lastLogin = lastLoginAgg._max.lastLoginAt;

  const invoices: SchoolInvoiceRow[] = invoicesRaw.map((inv) => {
    const paidAmount = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const lastPayment = inv.payments.reduce<Date | null>((latest, p) => (!latest || p.paidOn > latest ? p.paidOn : latest), null);
    return {
      id: inv.id,
      schoolName: school.name,
      plan: inv.plan?.name ?? null,
      billingPeriod: inv.billingPeriod,
      amount: Number(inv.amount),
      paidAmount,
      status: inv.status,
      dueDate: inv.dueDate.toISOString(),
      lastPaymentDate: lastPayment ? lastPayment.toISOString() : null,
    };
  });

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, minHeight: "100dvh", boxSizing: "border-box" }}>
      <div>
        <Link href="/super-admin/schools" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Schools
        </Link>
      </div>

      {setupToken && <SetupLinkBanner token={setupToken} />}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div className="disp" style={{ fontSize: 22 }}>
              {school.name}
            </div>
            <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
              {school.code}
            </span>
            <span className="pill" style={{ background: style.bg, color: style.fg }}>
              {style.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            {school.city}
            {school.state ? `, ${school.state}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/super-admin/contracts?new=1&school=${school.id}`} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", textDecoration: "none" }}>
            New contract →
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* School details */}
        <div className="card" style={{ padding: 22 }}>
          <SectionTitle>School details</SectionTitle>

          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <DetailRow label="Admin" value={admin?.name ?? "—"} />
            <DetailRow label="Admin username" value={admin?.username ?? "—"} mono />
            <DetailRow label="Onboarded" value={school.onboardedOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} mono last />
          </div>
          <SchoolEditForm school={{ id: school.id, name: school.name, code: school.code, city: school.city, state: school.state }} />

          <SubSectionTitle>Relationship manager</SubSectionTitle>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
            <RelationshipManagerField schoolId={school.id} relationshipManager={school.relationshipManager} />
          </div>

          <SubSectionTitle>Registered address</SubSectionTitle>
          <SchoolAddressForm school={school} canManage={canManage} />

          <SubSectionTitle>Documents</SubSectionTitle>
          <SchoolDocuments schoolId={school.id} documents={documents} canManage={canManage} />

          <SubSectionTitle>Notes</SubSectionTitle>
          <SchoolNotes schoolId={school.id} notes={notes} />
        </div>

        {/* Contact details */}
        <div className="card" style={{ padding: 22 }}>
          <SectionTitle>Contact details</SectionTitle>
          <SchoolContactForm schoolId={school.id} schoolAddress={school} contact={school.contactPerson} canManage={canManage} />
        </div>
      </div>

      {/* Usage details — read-only */}
      <div className="card" style={{ padding: 22 }}>
        <SectionTitle>Usage details</SectionTitle>
        <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 14, marginTop: -8 }}>Read-only — reflects current activity, not editable here.</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
          <Stat label="Students" value={studentCount} />
          <Stat label="Staff" value={staffCount} />
          <Stat label="Classes" value={classGrades.length} />
          <Stat label="Sections" value={classCount} />
          <Stat label="Transport vehicles" value={transportRouteCount} />
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Logins — distinct users</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
          <Stat label="Today" value={loginsToday.length} small />
          <Stat label="This week" value={loginsWeek.length} small />
          <Stat label="This month" value={loginsMonth.length} small />
          <Stat label="This year" value={loginsYear.length} small />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>Last login: {lastLogin ? lastLogin.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Never"}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          <ActivationRow label="Staff accounts" activated={staffActivated} total={staffTotal} />
          <ActivationRow label="Parent accounts" activated={parentActivated} total={parentTotal} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Parent accounts on record: {parentCount}</div>

        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>Module usage — last 30 days</div>
        <ModuleUsageChart data={moduleUsage} />
      </div>

      {/* Subscription & billing */}
      <div className="card" style={{ padding: 22 }}>
        <SectionTitle>Subscription & billing</SectionTitle>

        <SubSectionTitle first>Status</SubSectionTitle>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
          <StatusForm school={{ id: school.id, status: school.status }} />
        </div>

        <SubSectionTitle>Module access</SubSectionTitle>
        <ModuleAccessGrid schoolId={school.id} disabledModules={school.disabledModules} />

        <SubSectionTitle>Feature access (depth)</SubSectionTitle>
        <FeatureAccessGrid schoolId={school.id} enabledKeys={enabledFeatureKeys} />

        {showSchoolGroups && (
          <>
            <SubSectionTitle>Branch group</SubSectionTitle>
            <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
              <SchoolGroupField schoolId={school.id} groupId={school.groupId} groups={schoolGroups} />
            </div>
          </>
        )}

        <SubSectionTitle>Seat caps</SubSectionTitle>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px" }}>
          <CapsForm school={{ id: school.id, maxStudents: school.maxStudents, maxStaff: school.maxStaff, studentCount, staffCount }} />
        </div>

        <SubSectionTitle>Billing</SubSectionTitle>
        <SchoolBillingPanel schoolId={school.id} invoices={invoices} />

        <SubSectionTitle>Access control</SubSectionTitle>
        <AccessControlPanel schoolId={school.id} loginBlocked={school.loginBlocked} admin={admin ? { id: admin.id, name: admin.name, username: admin.username } : null} />
      </div>
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

function ActivationRow({ label, activated, total }: { label: string; activated: number; total: number }) {
  const pct = total > 0 ? Math.round((activated / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span className="mono" style={{ color: "var(--ink)" }}>
          {activated} / {total} activated
        </span>
      </div>
      <div style={{ height: 6, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--teal)", borderRadius: 4 }} />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{children}</div>;
}

function SubSectionTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: first ? "0 0 10px" : "18px 0 10px" }}>{children}</div>;
}

function Stat({ label, value, small }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className="card" style={{ padding: small ? "12px 14px" : "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: small ? 18 : 22, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
