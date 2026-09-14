"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { Prisma, Gender } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type BulkImportResult = { error?: string; rowErrors?: string[]; createdCount?: number };

const VALID_GENDERS = new Set(["MALE", "FEMALE", "OTHER"]);

/**
 * Parses the uploaded .xlsx (same shape as /api/students/import-template)
 * and creates every row as a new Student, all-or-nothing — same "validate
 * every row before writing any" discipline as the Exams bulk-marks CSV
 * import, so one typo doesn't leave a half-imported class list.
 */
export async function bulkImportStudents(formData: FormData): Promise<BulkImportResult> {
  await requireModuleAccess("Students", "EDIT");
  const session = await auth();
  const sdb = await getScopedDb();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a filled-in .xlsx file to upload." };
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return { error: "Couldn't read that file — make sure it's the .xlsx template, unmodified in structure." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { error: "The workbook has no sheet to read." };

  const classes = await sdb.class.findMany();
  const classByName = new Map(classes.map((c) => [`${c.grade}-${c.section}`.toLowerCase(), c]));
  const existingAdmissionNos = new Set((await sdb.student.findMany({ select: { admissionNo: true } })).map((s) => s.admissionNo.toLowerCase()));

  type Row = { admissionNo: string; firstName: string; surname: string; classId: string; dob: Date | null; gender: Gender | null };
  const rows: Row[] = [];
  const rowErrors: string[] = [];
  const seenAdmissionNos = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const cell = (i: number) => {
      const v = row.getCell(i).value;
      if (v == null) return "";
      if (typeof v === "object" && "text" in v) return String((v as { text: string }).text).trim();
      if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "").trim();
      return String(v).trim();
    };
    const admissionNo = cell(1);
    const firstName = cell(2);
    const surname = cell(3);
    const className = cell(4);
    const dobRaw = cell(5);
    const genderRaw = cell(6).toUpperCase();

    if (!admissionNo && !firstName && !surname && !className) return; // fully blank row, skip silently

    const label = `Row ${rowNumber}`;
    if (!admissionNo) return rowErrors.push(`${label}: admission number is required.`);
    if (!firstName) return rowErrors.push(`${label}: first name is required.`);
    if (!surname) return rowErrors.push(`${label}: surname is required.`);
    if (!className) return rowErrors.push(`${label}: class is required.`);

    const cls = classByName.get(className.toLowerCase());
    if (!cls) return rowErrors.push(`${label}: "${className}" doesn't match any existing class (check the "Valid Classes" sheet).`);

    const admissionKey = admissionNo.toLowerCase();
    if (existingAdmissionNos.has(admissionKey)) return rowErrors.push(`${label}: admission number "${admissionNo}" is already in use.`);
    if (seenAdmissionNos.has(admissionKey)) return rowErrors.push(`${label}: admission number "${admissionNo}" is duplicated within this file.`);
    seenAdmissionNos.add(admissionKey);

    let dob: Date | null = null;
    if (dobRaw) {
      const parsed = new Date(dobRaw);
      if (Number.isNaN(parsed.getTime())) return rowErrors.push(`${label}: date of birth "${dobRaw}" isn't a valid date (use YYYY-MM-DD).`);
      dob = parsed;
    }

    let gender: Gender | null = null;
    if (genderRaw) {
      if (!VALID_GENDERS.has(genderRaw)) return rowErrors.push(`${label}: gender "${genderRaw}" must be MALE, FEMALE, or OTHER (or left blank).`);
      gender = genderRaw as Gender;
    }

    rows.push({ admissionNo, firstName, surname, classId: cls.id, dob, gender });
  });

  if (rowErrors.length > 0) return { error: `Fix the following and re-upload — nothing was imported:`, rowErrors };
  if (rows.length === 0) return { error: "No student rows found in the file." };

  const school = await db.school.findUnique({ where: { id: session!.user.schoolId! }, select: { maxStudents: true } });
  if (school?.maxStudents != null) {
    const activeCount = await sdb.student.count({ where: { status: "ACTIVE" } });
    if (activeCount + rows.length > school.maxStudents) {
      return { error: `This import would exceed this school's student limit (${school.maxStudents}, currently ${activeCount} active). Contact Vidya Yati to raise it, or import fewer rows.` };
    }
  }

  await sdb.student.createMany({
    data: rows.map((r) =>
      scopedCreateData<Prisma.StudentUncheckedCreateInput>({
        admissionNo: r.admissionNo,
        firstName: r.firstName,
        surname: r.surname,
        classId: r.classId,
        dob: r.dob,
        gender: r.gender,
      })
    ),
  });

  revalidatePath("/app/students");
  return { createdCount: rows.length };
}
