import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import { getStaffLeaveSummary } from "../hr-depth-actions";
import StaffDetailTabs from "../StaffDetailTabs";
import Avatar from "@/components/Avatar";
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload";
import SetupLinkBanner from "@/components/SetupLinkBanner";
import { setStaffPhoto } from "../../settings/id-card-actions";

export default async function StaffProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ setupToken?: string }> }) {
  await requireModuleAccess("Employees", "VIEW");
  const session = await auth();
  const isAdmin = session!.user.role === "SCHOOL_ADMIN";
  const { id } = await params;
  const { setupToken } = await searchParams;
  const sdb = await getScopedDb();

  const selected = await sdb.staffProfile.findFirst({ where: { id }, include: { user: true } });
  if (!selected) notFound();

  const showDocuments = await hasFeature(session!.user.schoolId, "employees.documents");
  const showStructuredPayroll = await hasFeature(session!.user.schoolId, "payroll.structuredSalary");
  const showLeave = await hasFeature(session!.user.schoolId, "employees.leave");

  const [attendanceGroups, recentAttendance, payrollRuns, permissions, classes, documents, salaryComponents, allLeaveTypes, leaveRequests, pendingLeaveRequestsRaw, leaveSummary] = await Promise.all([
    sdb.staffAttendance.groupBy({ by: ["status"], where: { staffId: selected.id }, _count: true }),
    sdb.staffAttendance.findMany({ where: { staffId: selected.id }, orderBy: { date: "desc" }, take: 10 }),
    sdb.payrollRun.findMany({ where: { staffId: selected.id }, orderBy: { month: "desc" } }),
    sdb.staffPermission.findMany({ where: { staffId: selected.id } }),
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    showDocuments ? sdb.personDocument.findMany({ where: { staffId: selected.id, subjectType: "STAFF" }, orderBy: { uploadedAt: "desc" } }) : Promise.resolve([]),
    showStructuredPayroll ? sdb.salaryComponent.findMany({ where: { staffId: selected.id } }) : Promise.resolve([]),
    showLeave ? sdb.staffLeaveType.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    showLeave ? sdb.staffLeaveRequest.findMany({ where: { staffId: selected.id }, include: { leaveType: true }, orderBy: { requestedAt: "desc" } }) : Promise.resolve([]),
    showLeave && isAdmin ? sdb.staffLeaveRequest.findMany({ where: { status: "PENDING" }, include: { leaveType: true, staff: { include: { user: true } } }, orderBy: { requestedAt: "desc" } }) : Promise.resolve([]),
    showLeave ? getStaffLeaveSummary(selected.id) : Promise.resolve([]),
  ]);

  const attendanceTotals = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0 };
  for (const g of attendanceGroups) attendanceTotals[g.status] = g._count;
  const attendanceTotal = attendanceTotals.PRESENT + attendanceTotals.ABSENT + attendanceTotals.HALF_DAY;
  const attendancePct = attendanceTotal ? Math.round((attendanceTotals.PRESENT / attendanceTotal) * 100) : null;

  const yearsOfService = selected.dateJoined ? ((Date.now() - selected.dateJoined.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1) : null;

  const staff = {
    id: selected.id,
    designation: selected.designation,
    department: selected.department,
    dateJoined: selected.dateJoined?.toISOString() ?? null,
    employmentStatus: selected.employmentStatus,
    user: { name: selected.user.name, username: selected.user.username, phone: selected.user.phone },
    qualifications: selected.qualifications,
    specialization: selected.specialization,
    shiftStart: selected.shiftStart,
    isSelf: selected.userId === session!.user.id,
  };

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box", overflowY: "auto" }}>
      <div>
        <Link href="/app/employees" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
          ← Back to Employees
        </Link>
      </div>

      {setupToken && <SetupLinkBanner token={setupToken} />}

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative" }}>
          <Avatar photoPath={selected.photoPath} seed={selected.id} name={selected.user.name} size={56} fontSize={18} />
          {isAdmin && <ProfilePhotoUpload onUpload={setStaffPhoto.bind(null, selected.id)} />}
        </div>
        <div>
          <div className="disp" style={{ fontSize: 20 }}>
            {selected.user.name}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {[selected.designation, selected.department].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
          <QuickStat label="Attendance" value={attendancePct === null ? "—" : `${attendancePct}%`} color="var(--teal)" />
          <QuickStat
            label="Status"
            value={selected.employmentStatus === "ACTIVE" ? "Active" : "On Leave"}
            color={selected.employmentStatus === "ACTIVE" ? "var(--good)" : "var(--warn)"}
          />
          <QuickStat label="Years of service" value={yearsOfService ?? "—"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, fontSize: 12.5 }}>
          <BasicRow label="Designation" value={selected.designation ?? "—"} />
          <BasicRow label="Department" value={selected.department ?? "—"} />
          <BasicRow label="Date joined" value={selected.dateJoined ? selected.dateJoined.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"} />
          <BasicRow label="Contact" value={selected.user.phone ?? "—"} mono />
        </div>
      </div>

      <StaffDetailTabs
        staff={staff}
        isAdmin={isAdmin}
        attendanceTotals={attendanceTotals}
        recentAttendance={recentAttendance.map((a) => ({ date: a.date.toISOString(), status: a.status, checkInTime: a.checkInTime }))}
        payrollRuns={payrollRuns.map((p) => ({
          month: p.month,
          amount: Number(p.amount),
          status: p.status,
          paidOn: p.paidOn?.toISOString() ?? null,
          grossAmount: p.grossAmount ? Number(p.grossAmount) : null,
          pfAmount: p.pfAmount ? Number(p.pfAmount) : null,
          esiAmount: p.esiAmount ? Number(p.esiAmount) : null,
          tdsAmount: p.tdsAmount ? Number(p.tdsAmount) : null,
          ptAmount: p.ptAmount ? Number(p.ptAmount) : null,
          lopAmount: p.lopAmount ? Number(p.lopAmount) : null,
        }))}
        permissions={permissions.map((p) => ({ moduleName: p.moduleName, classId: p.classId, accessLevel: p.accessLevel }))}
        classes={classes.map((c) => ({ id: c.id, grade: c.grade, section: c.section }))}
        showDocuments={showDocuments}
        documents={documents.map((d) => ({
          id: d.id,
          category: d.category,
          label: d.label,
          filePath: d.filePath,
          expiryDate: d.expiryDate?.toISOString() ?? null,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        showStructuredPayroll={showStructuredPayroll}
        salaryComponents={salaryComponents.map((c) => ({ id: c.id, name: c.name, amount: Number(c.amount) }))}
        showLeave={showLeave}
        leaveTypes={leaveSummary}
        allLeaveTypes={allLeaveTypes.map((t) => ({ id: t.id, name: t.name }))}
        leaveRequests={leaveRequests.map((r) => ({ id: r.id, leaveTypeName: r.leaveType.name, dateFrom: r.dateFrom.toISOString(), dateTo: r.dateTo.toISOString(), reason: r.reason, status: r.status }))}
        pendingLeaveRequests={pendingLeaveRequestsRaw.map((r) => ({ id: r.id, leaveTypeName: r.leaveType.name, dateFrom: r.dateFrom.toISOString(), dateTo: r.dateTo.toISOString(), reason: r.reason, status: r.status, staffName: r.staff.user.name }))}
      />
    </div>
  );
}

function QuickStat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

function BasicRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div className={mono ? "mono" : undefined} style={{ fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}
