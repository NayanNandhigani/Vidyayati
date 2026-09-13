"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature, hasFeature } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

/** Shuffles students into seats across the given rooms, sequential seat numbers per room, in randomized order. */
export async function randomizeSeating(examId: string, roomIds: string[]) {
  const sdb = await getScopedDb();
  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId }, select: { classId: true } });
  await requireModuleAccess("Exams", "EDIT", exam.classId);
  await requireFeature(await schoolId(), "exams.seatingAndBulkMarks");

  if (roomIds.length === 0) throw new Error("Choose at least one room.");

  const validRooms = await sdb.room.findMany({ where: { id: { in: roomIds } }, select: { id: true } });
  if (validRooms.length !== roomIds.length) throw new Error("One or more selected rooms could not be found.");

  const students = await sdb.student.findMany({ where: { classId: exam.classId, status: "ACTIVE" } });
  const shuffled = [...students].sort(() => Math.random() - 0.5);

  await sdb.examSeating.deleteMany({ where: { examId } });

  const rows: Prisma.ExamSeatingUncheckedCreateInput[] = [];
  shuffled.forEach((student, i) => {
    const roomId = roomIds[i % roomIds.length];
    const seatNo = Math.floor(i / roomIds.length) + 1;
    rows.push(scopedCreateData<Prisma.ExamSeatingUncheckedCreateInput>({ examId, studentId: student.id, roomId, seatNo }));
  });
  if (rows.length > 0) await sdb.examSeating.createMany({ data: rows });

  revalidatePath("/app/exams");
  return { seated: rows.length };
}

export async function getSeating(examId: string) {
  const sdb = await getScopedDb();
  const seats = await sdb.examSeating.findMany({
    where: { examId },
    include: { student: true, room: true },
    orderBy: [{ room: { name: "asc" } }, { seatNo: "asc" }],
  });
  return seats.map((s) => ({ id: s.id, studentName: `${s.student.firstName} ${s.student.surname}`, roomName: s.room?.name ?? "Unassigned", seatNo: s.seatNo }));
}

/**
 * Bulk marks import — a CSV with an "Admission No" column plus one column
 * per subject (matching that exam's subject names exactly). Validates
 * every row before writing anything, so a typo doesn't half-import.
 */
export async function bulkImportMarks(examId: string, csvText: string): Promise<{ error?: string; imported?: number }> {
  const sdb = await getScopedDb();
  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId }, select: { classId: true } });
  await requireModuleAccess("Exams", "EDIT", exam.classId);
  await requireFeature(await schoolId(), "exams.seatingAndBulkMarks");

  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { error: "CSV needs a header row and at least one data row." };

  const headers = lines[0].split(",").map((h) => h.trim());
  const admissionIdx = headers.findIndex((h) => h.toLowerCase() === "admission no");
  if (admissionIdx === -1) return { error: 'First column must be "Admission No".' };

  const examSubjects = await sdb.examSubject.findMany({ where: { examId }, include: { subject: true } });
  const subjectByName = new Map(examSubjects.map((es) => [es.subject.name.toLowerCase(), es]));

  const students = await sdb.student.findMany({ where: { classId: exam.classId } });
  const studentByAdmissionNo = new Map(students.map((s) => [s.admissionNo, s]));

  type Row = { studentId: string; examSubjectId: string; marksObtained: number };
  const rows: Row[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const admissionNo = cells[admissionIdx];
    const student = studentByAdmissionNo.get(admissionNo);
    if (!student) {
      errors.push(`Row ${i + 1}: no student with admission no. "${admissionNo}" in this class.`);
      continue;
    }
    headers.forEach((header, colIdx) => {
      if (colIdx === admissionIdx) return;
      const examSubject = subjectByName.get(header.toLowerCase());
      if (!examSubject) return; // an unrecognized column is just ignored, not an error — lets the export include extra reference columns
      const raw = cells[colIdx];
      if (raw === undefined || raw === "") return;
      const value = Number(raw);
      if (Number.isNaN(value) || value < 0 || value > examSubject.maxMarks) {
        errors.push(`Row ${i + 1}: "${header}" value "${raw}" is not a valid mark out of ${examSubject.maxMarks}.`);
        return;
      }
      rows.push({ studentId: student.id, examSubjectId: examSubject.id, marksObtained: value });
    });
  }

  if (errors.length > 0) return { error: errors.slice(0, 5).join(" ") + (errors.length > 5 ? ` (+${errors.length - 5} more)` : "") };
  if (rows.length === 0) return { error: "No valid marks found to import." };

  await sdb.$transaction(
    rows.map((r) =>
      sdb.mark.upsert({
        where: { examSubjectId_studentId: { examSubjectId: r.examSubjectId, studentId: r.studentId } },
        update: { marksObtained: r.marksObtained },
        create: scopedCreateData<Prisma.MarkUncheckedCreateInput>({ examSubjectId: r.examSubjectId, studentId: r.studentId, marksObtained: r.marksObtained }),
      })
    )
  );

  revalidatePath("/app/exams");
  return { imported: rows.length };
}

export async function updateExamResultRelease(examId: string, releaseAt: string) {
  const sdb = await getScopedDb();
  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId }, select: { classId: true } });
  await requireModuleAccess("Exams", "EDIT", exam.classId);
  await requireFeature(await schoolId(), "exams.resultRelease");

  await sdb.exam.update({ where: { id: examId }, data: { resultReleaseAt: releaseAt ? new Date(releaseAt) : null } });
  revalidatePath("/app/exams");
}

export async function updateFeeLockSetting(enabled: boolean) {
  const sid = await schoolId();
  await requireModuleAccess("Exams", "EDIT");
  await requireFeature(sid, "exams.resultRelease");
  const sdb = await getScopedDb();
  await sdb.school.update({ where: { id: sid }, data: { resultsLockUntilFeesCleared: enabled } });
  revalidatePath("/app/exams");
}

/** Whether a parent should currently see this exam's marks for this student. */
export async function canViewExamResults(examId: string, studentId: string): Promise<{ visible: boolean; reason?: string }> {
  const sdb = await getScopedDb();
  const sid = await schoolId();

  // Not yet approved by a School Admin = not "successfully scheduled" —
  // this check applies regardless of the exams.resultRelease feature flag,
  // unlike the release-date/fee-lock checks below which are that feature's
  // own depth behaviour.
  const examStatus = await sdb.exam.findUnique({ where: { id: examId }, select: { approvalStatus: true } });
  if (examStatus?.approvalStatus !== "APPROVED") {
    return { visible: false, reason: "This exam hasn't been approved yet." };
  }

  const enabled = await hasFeature(sid, "exams.resultRelease");
  if (!enabled) return { visible: true };

  const [exam, school] = await Promise.all([
    sdb.exam.findUnique({ where: { id: examId }, select: { resultReleaseAt: true } }),
    sdb.school.findUniqueOrThrow({ where: { id: sid }, select: { resultsLockUntilFeesCleared: true } }),
  ]);

  if (exam?.resultReleaseAt && exam.resultReleaseAt > new Date()) {
    return { visible: false, reason: `Results release on ${exam.resultReleaseAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}.` };
  }

  if (school.resultsLockUntilFeesCleared) {
    const [structures, payments] = await Promise.all([
      sdb.feeStructure.findMany({ where: { class: { students: { some: { id: studentId } } } } }),
      sdb.feePayment.findMany({ where: { studentId } }),
    ]);
    const totalDue = structures.reduce((s, f) => s + Number(f.amount), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
    if (totalPaid < totalDue) {
      return { visible: false, reason: "Clear pending fee dues to view exam results." };
    }
  }

  return { visible: true };
}
