"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, SubmissionStatus } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type HomeworkFormState = { error?: string };

export async function createHomework(_prevState: HomeworkFormState, formData: FormData): Promise<HomeworkFormState> {
  const title = formData.get("title");
  const description = formData.get("description");
  const classId = formData.get("classId");
  const subjectId = formData.get("subjectId");
  const dueDate = formData.get("dueDate");

  if (
    typeof title !== "string" || !title.trim() ||
    typeof classId !== "string" || !classId ||
    typeof subjectId !== "string" || !subjectId ||
    typeof dueDate !== "string" || !dueDate
  ) {
    return { error: "Title, class, subject, and due date are required." };
  }

  await requireModuleAccess("Homework", "EDIT", classId);
  const session = await auth();
  const sdb = await getScopedDb();

  const staffProfile =
    session!.user.role === "STAFF" ? await db.staffProfile.findUnique({ where: { userId: session!.user.id } }) : null;

  if (session!.user.role === "STAFF" && !staffProfile) {
    return { error: "Staff profile not found." };
  }

  // classId/subjectId are client-supplied form fields — validate they
  // belong to this school before anything gets created against them.
  const cls = await sdb.class.findUnique({ where: { id: classId } });
  if (!cls) return { error: "That class could not be found." };
  const subject = await sdb.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return { error: "That subject could not be found." };

  // A Staff member's own homework is always attributed to themselves. A
  // School Admin has no staff record of their own, so the form asks them
  // to pick which teacher it should show as — defaulting to the class's
  // own class teacher when one is set, but not requiring it (many schools
  // haven't assigned class teachers to every section).
  let staffId = staffProfile?.id;
  if (!staffId) {
    const submittedStaffId = formData.get("staffId");
    if (typeof submittedStaffId === "string" && submittedStaffId) {
      const submittedStaff = await sdb.staffProfile.findUnique({ where: { id: submittedStaffId }, select: { id: true } });
      if (!submittedStaff) return { error: "That teacher could not be found." };
      staffId = submittedStaffId;
    } else {
      staffId = cls.classTeacherStaffId ?? undefined;
    }
  }
  if (!staffId) {
    return { error: "Select which teacher this assignment should be attributed to." };
  }

  const homework = await sdb.homework.create({
    data: scopedCreateData<Prisma.HomeworkUncheckedCreateInput>({
      title: title.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      classId,
      subjectId,
      staffId,
      dueDate: new Date(dueDate),
    }),
  });

  const students = await sdb.student.findMany({ where: { classId, status: "ACTIVE" }, select: { id: true } });
  if (students.length > 0) {
    await sdb.homeworkSubmission.createMany({
      data: students.map((s) =>
        scopedCreateData<Prisma.HomeworkSubmissionUncheckedCreateInput>({ assignmentId: homework.id, studentId: s.id })
      ),
    });
  }

  revalidatePath("/app/homework");
  redirect(`/app/homework?assignment=${homework.id}`);
}

export async function cycleSubmissionStatus(submissionId: string) {
  const sdb = await getScopedDb();
  const sub = await sdb.homeworkSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { assignment: { select: { classId: true } } } });
  await requireModuleAccess("Homework", "EDIT", sub.assignment.classId);

  const cycle: SubmissionStatus[] = ["PENDING", "SUBMITTED", "LATE"];
  const next = cycle[(cycle.indexOf(sub.status) + 1) % cycle.length];

  await sdb.homeworkSubmission.update({
    where: { id: submissionId },
    data: { status: next, submittedOn: next === "PENDING" ? null : (sub.submittedOn ?? new Date()) },
  });

  revalidatePath("/app/homework");
  return { status: next };
}

export async function setSubmissionScore(submissionId: string, score: number) {
  const sdb = await getScopedDb();
  const sub = await sdb.homeworkSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { assignment: { select: { classId: true } } } });
  await requireModuleAccess("Homework", "EDIT", sub.assignment.classId);
  await sdb.homeworkSubmission.update({ where: { id: submissionId }, data: { score } });
  revalidatePath("/app/homework");
}

export async function remindPending(assignmentId: string) {
  const sdb = await getScopedDb();

  const homework = await sdb.homework.findUniqueOrThrow({ where: { id: assignmentId } });
  await requireModuleAccess("Homework", "EDIT", homework.classId);
  const pending = await sdb.homeworkSubmission.findMany({ where: { assignmentId, status: "PENDING" } });

  if (pending.length === 0) return { remindedCount: 0 };

  await sdb.announcement.createMany({
    data: pending.map((p) =>
      scopedCreateData<Prisma.AnnouncementUncheckedCreateInput>({
        title: "Homework reminder",
        body: `"${homework.title}" is due ${homework.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} and hasn't been submitted yet.`,
        audienceType: "SPECIFIC_STUDENT",
        audienceTarget: p.studentId,
        publishedOn: new Date(),
      })
    ),
  });

  revalidatePath("/app/homework");
  return { remindedCount: pending.length };
}
