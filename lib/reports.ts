import type { ScopedDb } from "@/lib/tenant-db";
import { formatINR, formatDate, studentName } from "@/lib/format";

export const REPORT_KEYS = ["attendance", "fees", "academic", "admissions", "staff", "transport"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_TITLES: Record<ReportKey, string> = {
  attendance: "Attendance Summary",
  fees: "Fee Collection",
  academic: "Academic Performance",
  admissions: "Admissions Funnel",
  staff: "Staff Attendance",
  transport: "Transport Utilization",
};

export type ReportData = { columns: string[]; rows: (string | number)[][] };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function getAttendanceReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.attendance.findMany({
    where: { date: { gte: daysAgo(30) } },
    include: { student: { include: { class: true } } },
    orderBy: { date: "desc" },
  });
  return {
    columns: ["Student", "Class", "Date", "Status"],
    rows: rows.map((r) => [studentName(r.student), `${r.student.class.grade}-${r.student.class.section}`, formatDate(r.date), r.status]),
  };
}

async function getFeesReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.feePayment.findMany({
    include: { student: { include: { class: true } }, feeStructure: true },
    orderBy: { paidOn: "desc" },
  });
  return {
    columns: ["Student", "Class", "Term", "Amount", "Paid On"],
    rows: rows.map((r) => [studentName(r.student), `${r.student.class.grade}-${r.student.class.section}`, r.feeStructure.term, formatINR(Number(r.amount)), formatDate(r.paidOn)]),
  };
}

async function getAcademicReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.mark.findMany({
    include: { student: { include: { class: true } }, examSubject: { include: { exam: true, subject: true } } },
    orderBy: { examSubject: { exam: { startDate: "desc" } } },
  });
  return {
    columns: ["Student", "Class", "Exam", "Subject", "Marks Obtained", "Max Marks", "%"],
    rows: rows.map((r) => {
      const max = r.examSubject.maxMarks;
      const obtained = Number(r.marksObtained);
      const pct = max ? Math.round((obtained / max) * 100) : 0;
      return [studentName(r.student), `${r.student.class.grade}-${r.student.class.section}`, r.examSubject.exam.name, r.examSubject.subject.name, obtained, max, pct];
    }),
  };
}

async function getAdmissionsReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.admissionEnquiry.findMany({ orderBy: { createdAt: "desc" } });
  return {
    columns: ["Applicant Name", "Stage", "Class Applied", "Enquiry Date"],
    rows: rows.map((r) => [r.applicantName, r.stage, r.classApplied, formatDate(r.createdAt)]),
  };
}

async function getStaffReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.staffAttendance.findMany({
    where: { date: { gte: daysAgo(30) } },
    include: { staff: { include: { user: true } } },
    orderBy: { date: "desc" },
  });
  return {
    columns: ["Staff", "Date", "Status"],
    rows: rows.map((r) => [r.staff.user.name, formatDate(r.date), r.status]),
  };
}

async function getTransportReportData(sdb: ScopedDb): Promise<ReportData> {
  const rows = await sdb.transportRoute.findMany({ include: { assignments: true, vehicle: true } });
  return {
    columns: ["Route", "Driver", "Vehicle No.", "Capacity", "Riders", "Utilization %"],
    rows: rows.map((r) => {
      const riders = r.assignments.length;
      const capacity = r.vehicle?.capacity ?? null;
      const util = capacity ? Math.round((riders / capacity) * 100) : 0;
      return [r.name, r.vehicle?.driverName ?? "—", r.vehicle?.vehicleNo ?? "—", capacity ?? "—", riders, util];
    }),
  };
}

const GETTERS: Record<ReportKey, (sdb: ScopedDb) => Promise<ReportData>> = {
  attendance: getAttendanceReportData,
  fees: getFeesReportData,
  academic: getAcademicReportData,
  admissions: getAdmissionsReportData,
  staff: getStaffReportData,
  transport: getTransportReportData,
};

export async function getReportData(key: ReportKey, sdb: ScopedDb): Promise<ReportData> {
  return GETTERS[key](sdb);
}
