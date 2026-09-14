import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import { formatINR } from "@/lib/format";
import ReportBuilderPanel from "./ReportBuilderPanel";

export default async function ReportsPage() {
  await requireModuleAccess("Reports", "VIEW");
  const session = await auth();
  const sdb = await getScopedDb();
  const showBuilder = await hasFeature(session!.user.schoolId, "reports.customBuilder");
  const classesForBuilder = showBuilder ? await sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }) : [];

  const now = new Date();
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const [attendance, currentYear, exams, staffAttendance, routes, enquiries] = await Promise.all([
    sdb.attendance.findMany({ where: { date: { gte: eightWeeksAgo } }, select: { date: true, status: true } }),
    sdb.academicYear.findFirst({ where: { isCurrent: true } }),
    sdb.exam.findMany({ include: { examSubjects: { include: { marks: true } } }, orderBy: { startDate: "desc" }, take: 5 }),
    sdb.staffAttendance.findMany({ where: { date: { gte: eightWeeksAgo } }, select: { status: true } }),
    sdb.transportRoute.findMany({ include: { assignments: true, vehicle: true } }),
    sdb.admissionEnquiry.findMany({ select: { stage: true, createdAt: true } }),
  ]);

  const feeStructures = currentYear ? await sdb.feeStructure.findMany({ where: { yearId: currentYear.id } }) : [];
  const feePayments = await sdb.feePayment.findMany({ select: { amount: true, paidOn: true } });
  const billed = feeStructures.reduce((s, f) => s + Number(f.amount), 0);
  const collected = feePayments.reduce((s, p) => s + Number(p.amount), 0);

  const overallAttendancePct = attendance.length ? Math.round((attendance.filter((a) => a.status === "PRESENT").length / attendance.length) * 100) : 0;
  const feePct = billed ? Math.round((collected / billed) * 100) : 0;

  const examAvg = exams.length
    ? Math.round(
        exams.reduce((sum, e) => {
          const marks = e.examSubjects.flatMap((es) => es.marks.map((m) => ({ v: Number(m.marksObtained), max: es.maxMarks })));
          const pct = marks.length ? (marks.reduce((s, m) => s + m.v, 0) / marks.reduce((s, m) => s + m.max, 0)) * 100 : 0;
          return sum + pct;
        }, 0) / exams.length
      )
    : 0;

  const staffPresent = staffAttendance.filter((a) => a.status === "PRESENT").length;
  const staffAttPct = staffAttendance.length ? Math.round((staffPresent / staffAttendance.length) * 100) : 0;

  const totalSeats = routes.reduce((s, r) => s + (r.vehicle?.capacity ?? 0), 0);
  const totalRiders = routes.reduce((s, r) => s + r.assignments.length, 0);
  const transportUtil = totalSeats ? Math.round((totalRiders / totalSeats) * 100) : 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const enquiriesThisMonth = enquiries.filter((e) => e.createdAt >= monthStart).length;
  const admittedThisMonth = enquiries.filter((e) => e.createdAt >= monthStart && e.stage === "ADMITTED").length;
  const conversionPct = enquiriesThisMonth ? Math.round((admittedThisMonth / enquiriesThisMonth) * 100) : 0;

  const reportCards = [
    { key: "attendance", title: "Attendance Summary", desc: "Daily & monthly attendance by class", color: "var(--teal)", tint: "var(--teal-tint)", stat: `${overallAttendancePct}%`, href: "/app/reports/attendance" },
    { key: "fees", title: "Fee Collection", desc: "Collections, dues & defaulter list", color: "var(--marigold-deep)", tint: "var(--marigold-tint)", stat: `${feePct}% · ${formatINR(collected)}`, href: "/app/reports/fees" },
    { key: "academic", title: "Academic Performance", desc: "Exam results & subject-wise trends", color: "var(--info)", tint: "var(--info-tint)", stat: `${examAvg}% avg`, href: "/app/reports/academic" },
    { key: "admissions", title: "Admissions Funnel", desc: "Enquiry-to-admission conversion", color: "var(--good)", tint: "var(--good-tint)", stat: `${conversionPct}% conversion`, href: "/app/reports/admissions" },
    { key: "staff", title: "Staff Attendance", desc: "Teaching & non-teaching attendance log", color: "var(--warn)", tint: "var(--warn-tint)", stat: `${staffAttPct}%`, href: "/app/reports/staff" },
    { key: "transport", title: "Transport Utilization", desc: "Route-wise ridership & seat occupancy", color: "var(--teal)", tint: "var(--teal-tint)", stat: `${transportUtil}%`, href: "/app/reports/transport" },
  ];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box", ...(showBuilder ? { minHeight: "100dvh", overflowY: "auto" } : { height: "100dvh" }) }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Reports &amp; analytics
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "repeat(2,1fr)", gap: 14, flex: 1, minHeight: 0 }}>
        {reportCards.map((r) => (
          <Link key={r.key} href={r.href} className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: r.tint, flex: "none" }} />
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{r.desc}</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: r.color, marginTop: "auto" }}>
              {r.stat}
            </div>
            <div style={{ fontSize: 11, color: "var(--marigold-deep)", fontWeight: 600, marginTop: 6 }}>View details →</div>
          </Link>
        ))}
      </div>

      {showBuilder && (
        <div className="card" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Custom report builder</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Pick an entity, filter it down, choose your columns, and export the result as CSV.</div>
          <ReportBuilderPanel classes={classesForBuilder.map((c) => ({ id: c.id, label: `${c.grade}-${c.section}` }))} />
        </div>
      )}
    </div>
  );
}
