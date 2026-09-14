import { db } from "@/lib/db";

/**
 * The registry of every "depth" sub-feature a Super Admin can turn on/off
 * per school — a second, finer-grained axis alongside School.disabledModules
 * (which turns a whole module off). Keys are grouped by the module they
 * belong to (matching sidebar-config.ts's module names) purely for the
 * Super Admin UI's grouping; the key string itself is what's stored.
 *
 * New keys get added here exactly when the feature they gate ships — never
 * speculatively — so the Super Admin toggle grid never shows a switch for
 * something that doesn't actually exist yet.
 *
 * Default is always `false` (opt-in): a school that hasn't been granted a
 * "depth" feature sees the same baseline module it always has. Nothing in
 * this file changes what any school sees until a Super Admin flips a
 * switch for it.
 */
export const FEATURE_REGISTRY = {
  "students.medicalInfo": {
    module: "Students",
    label: "Medical info & emergency contacts",
    description: "Blood group, allergies/conditions, and a prioritized emergency contact list on each student profile.",
  },
  "students.documents": {
    module: "Students",
    label: "Student document repository",
    description: "Upload and categorize documents (ID proof, certificates, medical) per student, with expiry tracking.",
  },
  "students.priorSchool": {
    module: "Students",
    label: "Prior school & academic history",
    description: "Previous school, TC details, and a prior-performance note on a student's profile.",
  },
  "students.siblings": {
    module: "Students",
    label: "Sibling view & discount",
    description: "Surface siblings (students sharing a guardian) on the profile, and auto-apply a sibling fee discount.",
  },
  "employees.documents": {
    module: "Employees",
    label: "Staff document repository",
    description: "Upload and categorize documents (certificates, ID proofs) per staff member, with expiry/renewal alerts.",
  },
  "employees.leave": {
    module: "Employees",
    label: "Staff leave management",
    description: "Leave types, balances, and an approval workflow for staff leave requests.",
  },
  "employees.shifts": {
    module: "Employees",
    label: "Shift timing & late-arrival flagging",
    description: "Configure a staff member's shift start time and flag late clock-ins on staff attendance.",
  },
  "employees.detailedProfile": {
    module: "Employees",
    label: "Detailed staff application profile",
    description: "Full teaching/non-teaching application form — personal, contact, employment, qualification, and banking details.",
  },
  "attendance.studentLeave": {
    module: "Attendance",
    label: "Student leave requests",
    description: "Parents submit leave requests; class teacher then admin approve, feeding into the attendance record.",
  },
  "attendance.defaulterAlerts": {
    module: "Attendance",
    label: "Defaulter threshold & consecutive-absence flags",
    description: "Configurable attendance % threshold and a flag after N consecutive absences.",
  },
  "classes.capacityAndCurriculum": {
    module: "Students",
    label: "Section capacity & curriculum board",
    description: "Max-strength per section with breach warnings, a curriculum/board field per class, and elective/credit flags per subject.",
  },
  "classes.coTeacherAndReshuffle": {
    module: "Students",
    label: "Co-class-teacher & bulk reshuffle",
    description: "Assign a co-class-teacher, and bulk-move students between sections/years.",
  },
  "timetable.roomsAndConflicts": {
    module: "Timetable",
    label: "Room allocation & conflict detection",
    description: "Rooms/labs with capacity, plus double-booking detection when scheduling a slot.",
  },
  "exams.seatingAndBulkMarks": {
    module: "Exams",
    label: "Seating arrangement & bulk marks import",
    description: "Randomized room-wise seating per exam, and a spreadsheet import for marks entry.",
  },
  "exams.resultRelease": {
    module: "Exams",
    label: "Scheduled result release & fee-lock",
    description: "Hold results until a scheduled date/time, optionally locked until fees are cleared.",
  },
  "homework.attachmentsAndDigest": {
    module: "Homework",
    label: "Attachments & parent digest",
    description: "File attachments on assignments and submissions (submitted by the parent on the student's behalf), plus an overdue-homework dashboard.",
  },
  "fees.discountsAndFines": {
    module: "Fees",
    label: "Discount rules & late-fee calculation",
    description: "Scholarship/sibling discount rules and automatic late-fee calculation on overdue fees.",
  },
  "fees.gstReceipts": {
    module: "Fees",
    label: "GST-compliant receipts",
    description: "Tax breakdown on fee receipts, using the school's GSTIN and tax rate.",
  },
  "accounts.chartOfAccounts": {
    module: "Accounts",
    label: "Chart of accounts & Income/Expenditure report",
    description: "Structured account heads on transactions, and an Income & Expenditure statement by period.",
  },
  "accounts.approvals": {
    module: "Accounts",
    label: "Transaction approval threshold",
    description: "Transactions above a configured amount require a second admin's approval before posting.",
  },
  "payroll.structuredSalary": {
    module: "Accounts",
    label: "Structured payroll & payslips",
    description: "Component-wise salary (basic/HRA/allowances), statutory deductions (PF/ESI/TDS/PT), and payslip generation.",
  },
  "transport.liveLocation": {
    module: "Transport",
    label: "Live route location",
    description: "Driver/admin can post a route's current location; parents see the last known position on a simple map.",
  },
  "transport.complianceAndFees": {
    module: "Transport",
    label: "Vehicle/driver compliance & distance-based fees",
    description: "License/insurance/fitness expiry tracking per route, and zone/distance-based transport fee slabs.",
  },
  "library.barcodesAndFines": {
    module: "Library",
    label: "Barcode/QR tagging & fine collection",
    description: "Printable barcode/QR per book for scan-based issue/return, and a configurable per-day fine actually charged (not just tracked).",
  },
  "library.isbnLookup": {
    module: "Library",
    label: "ISBN lookup auto-fill",
    description: "Look up a book's title/author/cover from its ISBN via a public catalog when cataloging.",
  },
  "hostel.operations": {
    module: "Transport",
    label: "Hostel room types, warden, mess & visitor log",
    description: "Room-type configuration, warden assignment, a weekly mess menu, and a visitor/outing log.",
  },
  "inventory.module": {
    module: "Inventory",
    label: "Inventory & Asset Management",
    description: "Asset register, consumable stock tracking, purchase orders/vendors, and depreciation.",
  },
  "compliance.udise": {
    module: "Settings",
    label: "UDISE+ & compliance reporting",
    description: "UDISE+-structured data export, RTE quota tracking, and affiliation renewal document tracking.",
  },
  "reports.customBuilder": {
    module: "Reports",
    label: "Custom report builder",
    description: "Pick an entity, filters, and columns to build and export an ad-hoc report as CSV.",
  },
  "admin.schoolGroups": {
    module: "Settings",
    label: "Multi-branch group rollup",
    description: "Tag this school as part of a group so Super Admin can view cross-branch rollup reports.",
  },
  "admissions.detailedForm": {
    module: "Admissions",
    label: "Detailed application form & admit approval",
    description: "Full student/parent/address/health/academic-reference application form, a printable admission form, and an admit-approval workflow before a student is created.",
  },
} as const;

export type FeatureKey = keyof typeof FEATURE_REGISTRY;

export const FEATURE_KEYS = Object.keys(FEATURE_REGISTRY) as FeatureKey[];

/** All feature flags for a school as a flat {key: enabled} map — rows that don't exist yet default to false. */
export async function getSchoolFeatures(schoolId: string): Promise<Record<FeatureKey, boolean>> {
  const rows = await db.schoolFeatureFlag.findMany({ where: { schoolId } });
  const enabled = new Set(rows.filter((r) => r.enabled).map((r) => r.key));
  const result = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) result[key] = enabled.has(key);
  return result;
}

export async function hasFeature(schoolId: string | null | undefined, key: FeatureKey): Promise<boolean> {
  if (!schoolId) return false;
  const row = await db.schoolFeatureFlag.findUnique({ where: { schoolId_key: { schoolId, key } } });
  return row?.enabled ?? false;
}

/** Throws if the school hasn't been granted this feature — mirrors requireModuleAccess's throw-based gate. */
export async function requireFeature(schoolId: string | null | undefined, key: FeatureKey): Promise<void> {
  if (!(await hasFeature(schoolId, key))) {
    const meta = FEATURE_REGISTRY[key];
    throw new Error(`"${meta.label}" is not enabled for this school. Ask Vidya Yati to turn it on.`);
  }
}
