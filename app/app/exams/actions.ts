"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { calculateExamResults } from "@/lib/domain/exam-results";

export type ExamFormState = { error?: string };

export async function createExam(_prevState: ExamFormState, formData: FormData): Promise<ExamFormState> {
  const name = formData.get("name");
  const classIds = formData.getAll("classIds") as string[];
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const subjectIds = formData.getAll("subjectIds") as string[];

  if (
    typeof name !== "string" || !name.trim() ||
    classIds.length === 0 ||
    typeof startDate !== "string" || !startDate ||
    typeof endDate !== "string" || !endDate ||
    subjectIds.length === 0
  ) {
    return { error: "Name, at least one class, dates, and at least one subject are required." };
  }

  // Same exam (name/dates/subjects) scheduled once per selected class — the
  // data model keeps one Exam row per class (marks/seating/report cards
  // all key off a single class), so "multiple classes" means creating one
  // sibling Exam per class rather than reshaping that model. Check every
  // selected class's permission up front so a partial failure can't create
  // some exams but not others.
  for (const classId of classIds) {
    await requireModuleAccess("Exams", "EDIT", classId);
  }

  const sdb = await getScopedDb();

  // subjectIds are client-supplied — validate every one belongs to this
  // school before any exam/examSubject rows reference them.
  const validSubjects = await sdb.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true } });
  if (validSubjects.length !== subjectIds.length) {
    return { error: "One or more selected subjects could not be found." };
  }

  let firstExamId: string | null = null;

  for (const classId of classIds) {
    const cls = await sdb.class.findUniqueOrThrow({ where: { id: classId } });

    // An exam with no subjects yet is a broken intermediate state — the
    // create and its examSubjects must land together or not at all. Each
    // class's exam is independent of the others (one sibling Exam per
    // class, per the design note above), so this transacts per-class
    // rather than across the whole classIds loop.
    const examId = await sdb.$transaction(async (tx) => {
      // Every newly scheduled exam starts PENDING, regardless of who
      // schedules it (School Admin included) — it only counts as
      // successfully scheduled once explicitly approved via approveExam.
      const exam = await tx.exam.create({
        data: scopedCreateData<Prisma.ExamUncheckedCreateInput>({
          name: name.trim(),
          classId,
          yearId: cls.yearId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          approvalStatus: "PENDING",
        }),
      });

      await tx.examSubject.createMany({
        data: subjectIds.map((subjectId) =>
          scopedCreateData<Prisma.ExamSubjectUncheckedCreateInput>({
            examId: exam.id,
            subjectId,
            maxMarks: Number(formData.get(`maxMarks_${subjectId}`)) || 100,
          })
        ),
      });

      return exam.id;
    });

    firstExamId ??= examId;
  }

  revalidatePath("/app/exams");
  redirect(`/app/exams?exam=${firstExamId}&classId=${classIds[0]}`);
}

export async function saveMarks(examId: string, marks: Record<string, Record<string, number>>) {
  const sdb = await getScopedDb();
  // An Exam belongs to exactly one Class, so every mark in this batch is
  // for that same class — one lookup covers the whole call.
  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId }, select: { classId: true } });
  await requireModuleAccess("Exams", "EDIT", exam.classId);

  // examSubjectId/studentId keys come straight from client-submitted marks —
  // restrict writes to ids that actually belong to this exam/school so a
  // tampered payload can't attach a Mark to another school's data. Also
  // carries maxMarks per subject, used below to reject out-of-range marks
  // (Phase 10 items 97/98: no negative marks, none over the subject's max).
  const validExamSubjects = await sdb.examSubject.findMany({ where: { examId }, select: { id: true, maxMarks: true } });
  const maxMarksByExamSubject = new Map(validExamSubjects.map((s) => [s.id, s.maxMarks]));
  const studentIds = Object.keys(marks);
  const validStudents = await sdb.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } });
  const validStudentIds = new Set(validStudents.map((s) => s.id));

  const ops = [];
  for (const [studentId, bySubject] of Object.entries(marks)) {
    if (!validStudentIds.has(studentId)) continue;
    for (const [examSubjectId, marksObtained] of Object.entries(bySubject)) {
      const maxMarks = maxMarksByExamSubject.get(examSubjectId);
      if (maxMarks === undefined) continue;
      if (marksObtained < 0 || marksObtained > maxMarks) continue;
      ops.push(
        sdb.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId } },
          update: { marksObtained },
          create: scopedCreateData<Prisma.MarkUncheckedCreateInput>({ examSubjectId, studentId, marksObtained }),
        })
      );
    }
  }

  if (ops.length > 0) await sdb.$transaction(ops);
  await calculateExamResults(examId);
  revalidatePath("/app/exams");
  return { success: true };
}

export type UpdateExamFields = {
  name: string;
  startDate: string;
  endDate: string;
  // Existing subjects are keyed by their examSubjectId (maxMarks only, no
  // add/remove — subjects already have Marks recorded against them, so
  // deleting one would cascade-delete those); a row with no examSubjectId
  // is a brand new subject being added to the exam, which is safe.
  subjects: { examSubjectId?: string; subjectId: string; maxMarks: number }[];
};

/** Editing a scheduled exam sends it back to PENDING for re-approval, regardless of who edits it (School Admin included) — a changed exam needs a fresh sign-off just like a newly scheduled one does. */
export async function updateExam(examId: string, fields: UpdateExamFields) {
  const sdb = await getScopedDb();
  const exam = await sdb.exam.findUniqueOrThrow({ where: { id: examId } });
  await requireModuleAccess("Exams", "EDIT", exam.classId);

  if (!fields.name.trim() || !fields.startDate || !fields.endDate) {
    throw new Error("Name and both dates are required.");
  }

  await sdb.exam.update({
    where: { id: examId },
    data: {
      name: fields.name.trim(),
      startDate: new Date(fields.startDate),
      endDate: new Date(fields.endDate),
      approvalStatus: "PENDING",
    },
  });

  for (const s of fields.subjects) {
    if (s.examSubjectId) {
      await sdb.examSubject.update({ where: { id: s.examSubjectId }, data: { maxMarks: s.maxMarks } });
    } else {
      await sdb.subject.findUniqueOrThrow({ where: { id: s.subjectId }, select: { id: true } });
      await sdb.examSubject.create({
        data: scopedCreateData<Prisma.ExamSubjectUncheckedCreateInput>({ examId, subjectId: s.subjectId, maxMarks: s.maxMarks }),
      });
    }
  }

  revalidatePath("/app/exams");
}

export async function approveExam(examId: string) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can approve an exam.");
  await requireModuleAccess("Exams", "EDIT");
  const sdb = await getScopedDb();
  await sdb.exam.update({ where: { id: examId }, data: { approvalStatus: "APPROVED" } });
  revalidatePath("/app/exams");
}

export async function rejectExam(examId: string) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can reject an exam.");
  await requireModuleAccess("Exams", "EDIT");
  const sdb = await getScopedDb();
  await sdb.exam.update({ where: { id: examId }, data: { approvalStatus: "REJECTED" } });
  revalidatePath("/app/exams");
}
