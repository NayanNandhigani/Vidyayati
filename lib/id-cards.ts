import type { IdCardAudience } from "@prisma/client";

// One entry per {{token}} a TEXT element can carry. `label` is what shows
// in the editor's "+ Field" insert menu; `sample` is what the editor
// canvas shows before a specific person is being previewed, so a template
// never looks like broken text while it's being designed.
export type MergeField = { token: string; label: string; sample: string };

export const STUDENT_MERGE_FIELDS: MergeField[] = [
  { token: "{{studentName}}", label: "Student name", sample: "Aarav Mehta" },
  { token: "{{admissionNo}}", label: "Admission no.", sample: "STU-2026-0417" },
  { token: "{{className}}", label: "Class", sample: "Grade 6 - B" },
  { token: "{{gender}}", label: "Gender", sample: "Male" },
  { token: "{{dob}}", label: "Date of birth", sample: "12 Apr 2015" },
  { token: "{{parentName}}", label: "Parent/guardian name", sample: "R. Mehta" },
  { token: "{{parentPhone}}", label: "Parent/guardian phone", sample: "+91 98765 43210" },
  { token: "{{schoolName}}", label: "School name", sample: "Sunrise Public School" },
  { token: "{{schoolCode}}", label: "School code", sample: "SUN0001" },
];

export const STAFF_MERGE_FIELDS: MergeField[] = [
  { token: "{{staffName}}", label: "Staff name", sample: "R. Sharma" },
  { token: "{{designation}}", label: "Designation", sample: "Class Teacher — 6B" },
  { token: "{{department}}", label: "Department", sample: "Academics" },
  { token: "{{phone}}", label: "Phone", sample: "+91 98765 12345" },
  { token: "{{email}}", label: "Email", sample: "r.sharma@sunrise.edu" },
  { token: "{{schoolName}}", label: "School name", sample: "Sunrise Public School" },
  { token: "{{schoolCode}}", label: "School code", sample: "SUN0001" },
];

export function mergeFieldsFor(audience: IdCardAudience): MergeField[] {
  return audience === "STAFF" ? STAFF_MERGE_FIELDS : STUDENT_MERGE_FIELDS;
}

// Replaces every {{token}} in `text` with values from `ctx`; any token not
// present in ctx (e.g. one audience's field left over after a template was
// switched to the other audience) is left as-is rather than blanked out,
// so a stray token stays visibly a stray token instead of silently
// vanishing.
export function renderIdCardText(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => (key in ctx ? ctx[key] : whole));
}

function formatDob(dob: Date | null): string {
  if (!dob) return "—";
  return dob.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function studentMergeContext(student: {
  firstName: string;
  surname: string;
  admissionNo: string;
  gender: string | null;
  dob: Date | null;
  class: { grade: string; section: string };
}, school: { name: string; code: string }, guardian: { name: string; phone: string | null } | null): Record<string, string> {
  return {
    studentName: `${student.firstName} ${student.surname}`,
    admissionNo: student.admissionNo,
    className: `Grade ${student.class.grade} - ${student.class.section}`,
    gender: student.gender ? student.gender[0] + student.gender.slice(1).toLowerCase() : "—",
    dob: formatDob(student.dob),
    parentName: guardian?.name ?? "—",
    parentPhone: guardian?.phone ?? "—",
    schoolName: school.name,
    schoolCode: school.code,
  };
}

export function staffMergeContext(staff: {
  user: { name: string; phone: string | null; email: string | null };
  designation: string | null;
  department: string | null;
}, school: { name: string; code: string }): Record<string, string> {
  return {
    staffName: staff.user.name,
    designation: staff.designation ?? "—",
    department: staff.department ?? "—",
    phone: staff.user.phone ?? "—",
    email: staff.user.email ?? "—",
    schoolName: school.name,
    schoolCode: school.code,
  };
}

export function sampleMergeContext(audience: IdCardAudience): Record<string, string> {
  const ctx: Record<string, string> = {};
  for (const f of mergeFieldsFor(audience)) ctx[f.token.replace(/\{\{|\}\}/g, "")] = f.sample;
  return ctx;
}

// CR80 card ratio (3.375in × 2.125in ≈ 1.588:1), scaled up to a
// comfortable on-screen editing size — not a physical/print calibration,
// just pixels for the canvas editor.
export const CARD_SIZE = {
  HORIZONTAL: { width: 480, height: 302 },
  VERTICAL: { width: 302, height: 480 },
} as const;
