// Custom Report Builder (Batch 18) — an entity + filter + column picker,
// deliberately built instead of a visual drag-and-drop designer (no
// suitable library, and this gives the same testable outcome: pick what
// you want to see, export it). Lives alongside the fixed reports in
// lib/reports.ts, which stay completely untouched — this is a new,
// separate capability, not a rewrite.
import type { ScopedDb } from "@/lib/tenant-db";
import { formatINR, formatDate, studentName } from "@/lib/format";

export const BUILDER_ENTITIES = ["students", "staff", "attendance", "feePayments", "examMarks"] as const;
export type BuilderEntity = (typeof BUILDER_ENTITIES)[number];

export const ENTITY_LABELS: Record<BuilderEntity, string> = {
  students: "Students",
  staff: "Staff",
  attendance: "Attendance",
  feePayments: "Fee Payments",
  examMarks: "Exam Marks",
};

export type ColumnDef = { key: string; label: string };
export type FilterType = "class" | "dateRange" | "select";
export type FilterDef = { key: string; label: string; type: FilterType; options?: string[] };

export const ENTITY_COLUMNS: Record<BuilderEntity, ColumnDef[]> = {
  students: [
    { key: "name", label: "Name" },
    { key: "admissionNo", label: "Admission No." },
    { key: "class", label: "Class" },
    { key: "gender", label: "Gender" },
    { key: "status", label: "Status" },
  ],
  staff: [
    { key: "name", label: "Name" },
    { key: "designation", label: "Designation" },
    { key: "department", label: "Department" },
    { key: "employmentStatus", label: "Status" },
  ],
  attendance: [
    { key: "student", label: "Student" },
    { key: "class", label: "Class" },
    { key: "date", label: "Date" },
    { key: "status", label: "Status" },
  ],
  feePayments: [
    { key: "student", label: "Student" },
    { key: "class", label: "Class" },
    { key: "term", label: "Term" },
    { key: "amount", label: "Amount" },
    { key: "method", label: "Method" },
    { key: "paidOn", label: "Paid On" },
  ],
  examMarks: [
    { key: "student", label: "Student" },
    { key: "class", label: "Class" },
    { key: "exam", label: "Exam" },
    { key: "subject", label: "Subject" },
    { key: "marksObtained", label: "Marks" },
    { key: "maxMarks", label: "Max" },
  ],
};

export const ENTITY_FILTERS: Record<BuilderEntity, FilterDef[]> = {
  students: [
    { key: "classId", label: "Class", type: "class" },
    { key: "status", label: "Status", type: "select", options: ["ACTIVE", "ALUMNI"] },
    { key: "gender", label: "Gender", type: "select", options: ["MALE", "FEMALE", "OTHER"] },
  ],
  staff: [{ key: "employmentStatus", label: "Status", type: "select", options: ["ACTIVE", "ON_LEAVE"] }],
  attendance: [
    { key: "classId", label: "Class", type: "class" },
    { key: "dateRange", label: "Date range", type: "dateRange" },
    { key: "status", label: "Status", type: "select", options: ["PRESENT", "ABSENT", "HALF_DAY"] },
  ],
  feePayments: [
    { key: "classId", label: "Class", type: "class" },
    { key: "dateRange", label: "Paid-on range", type: "dateRange" },
  ],
  examMarks: [{ key: "classId", label: "Class", type: "class" }],
};

export type BuilderFilters = { classId?: string; status?: string; gender?: string; employmentStatus?: string; dateFrom?: string; dateTo?: string };
export type ReportData = { columns: string[]; rows: (string | number)[][] };

function dateRangeWhere(filters: BuilderFilters) {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return { ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}) };
}

async function runStudents(sdb: ScopedDb, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  const rows = await sdb.student.findMany({
    where: { ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.status ? { status: filters.status as never } : {}), ...(filters.gender ? { gender: filters.gender as never } : {}) },
    include: { class: true },
    orderBy: [{ firstName: "asc" }, { surname: "asc" }],
  });
  const cell: Record<string, (r: (typeof rows)[number]) => string | number> = {
    name: (r) => studentName(r),
    admissionNo: (r) => r.admissionNo,
    class: (r) => `${r.class.grade}-${r.class.section}`,
    gender: (r) => r.gender ?? "—",
    status: (r) => r.status,
  };
  return { columns, rows: rows.map((r) => columns.map((c) => cell[c](r))) };
}

async function runStaff(sdb: ScopedDb, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  const rows = await sdb.staffProfile.findMany({
    where: { ...(filters.employmentStatus ? { employmentStatus: filters.employmentStatus as never } : {}) },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
  const cell: Record<string, (r: (typeof rows)[number]) => string | number> = {
    name: (r) => r.user.name,
    designation: (r) => r.designation ?? "—",
    department: (r) => r.department ?? "—",
    employmentStatus: (r) => r.employmentStatus,
  };
  return { columns, rows: rows.map((r) => columns.map((c) => cell[c](r))) };
}

async function runAttendance(sdb: ScopedDb, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  const rows = await sdb.attendance.findMany({
    where: { ...(filters.classId ? { classId: filters.classId } : {}), ...(filters.status ? { status: filters.status as never } : {}), ...(dateRangeWhere(filters) ? { date: dateRangeWhere(filters) } : {}) },
    include: { student: { include: { class: true } } },
    orderBy: { date: "desc" },
    take: 2000,
  });
  const cell: Record<string, (r: (typeof rows)[number]) => string | number> = {
    student: (r) => studentName(r.student),
    class: (r) => `${r.student.class.grade}-${r.student.class.section}`,
    date: (r) => formatDate(r.date),
    status: (r) => r.status,
  };
  return { columns, rows: rows.map((r) => columns.map((c) => cell[c](r))) };
}

async function runFeePayments(sdb: ScopedDb, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  const rows = await sdb.feePayment.findMany({
    where: { ...(filters.classId ? { student: { classId: filters.classId } } : {}), ...(dateRangeWhere(filters) ? { paidOn: dateRangeWhere(filters) } : {}) },
    include: { student: { include: { class: true } }, feeStructure: true },
    orderBy: { paidOn: "desc" },
    take: 2000,
  });
  const cell: Record<string, (r: (typeof rows)[number]) => string | number> = {
    student: (r) => studentName(r.student),
    class: (r) => `${r.student.class.grade}-${r.student.class.section}`,
    term: (r) => r.feeStructure.term,
    amount: (r) => formatINR(Number(r.amount)),
    method: (r) => r.method,
    paidOn: (r) => formatDate(r.paidOn),
  };
  return { columns, rows: rows.map((r) => columns.map((c) => cell[c](r))) };
}

async function runExamMarks(sdb: ScopedDb, columns: string[], filters: BuilderFilters): Promise<ReportData> {
  const rows = await sdb.mark.findMany({
    where: { ...(filters.classId ? { student: { classId: filters.classId } } : {}) },
    include: { student: { include: { class: true } }, examSubject: { include: { exam: true, subject: true } } },
    orderBy: { examSubject: { exam: { startDate: "desc" } } },
    take: 2000,
  });
  const cell: Record<string, (r: (typeof rows)[number]) => string | number> = {
    student: (r) => studentName(r.student),
    class: (r) => `${r.student.class.grade}-${r.student.class.section}`,
    exam: (r) => r.examSubject.exam.name,
    subject: (r) => r.examSubject.subject.name,
    marksObtained: (r) => Number(r.marksObtained),
    maxMarks: (r) => r.examSubject.maxMarks,
  };
  return { columns, rows: rows.map((r) => columns.map((c) => cell[c](r))) };
}

const RUNNERS: Record<BuilderEntity, (sdb: ScopedDb, columns: string[], filters: BuilderFilters) => Promise<ReportData>> = {
  students: runStudents,
  staff: runStaff,
  attendance: runAttendance,
  feePayments: runFeePayments,
  examMarks: runExamMarks,
};

export async function runCustomReport(entity: BuilderEntity, columnKeys: string[], filters: BuilderFilters, sdb: ScopedDb): Promise<ReportData> {
  const valid = new Set(ENTITY_COLUMNS[entity].map((c) => c.key));
  const columns = columnKeys.filter((c) => valid.has(c));
  if (columns.length === 0) return { columns: [], rows: [] };
  const data = await RUNNERS[entity](sdb, columns, filters);
  const labelByKey = new Map(ENTITY_COLUMNS[entity].map((c) => [c.key, c.label]));
  return { columns: data.columns.map((c) => labelByKey.get(c) ?? c), rows: data.rows };
}
