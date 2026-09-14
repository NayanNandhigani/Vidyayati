"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature, hasFeature } from "@/lib/feature-flags";
import { saveUploadedFile } from "@/lib/storage";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

export async function uploadHomeworkAttachment(homeworkId: string, formData: FormData) {
  const sdb = await getScopedDb();
  const hw = await sdb.homework.findUniqueOrThrow({ where: { id: homeworkId } });
  await requireModuleAccess("Homework", "EDIT", hw.classId);
  await requireFeature(await schoolId(), "homework.attachmentsAndDigest");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`documents/${await schoolId()}`, file.name, bytes);

  await sdb.homework.update({ where: { id: homeworkId }, data: { attachmentPath: storagePath } });
  revalidatePath("/app/homework");
}

/** Uploaded by the parent on the student's behalf — there's no student login in this app, so this is the closest equivalent to "student submission portal". */
export async function uploadSubmissionAttachment(submissionId: string, formData: FormData) {
  const sdb = await getScopedDb();
  const session = await auth();
  if (session!.user.role !== "PARENT") throw new Error("Only a parent can submit homework on their child's behalf.");
  await requireFeature(session!.user.schoolId!, "homework.attachmentsAndDigest");

  const sub = await sdb.homeworkSubmission.findUniqueOrThrow({ where: { id: submissionId } });
  const parent = await sdb.parent.findUnique({ where: { userId: session!.user.id }, include: { studentLinks: true } });
  if (!parent?.studentLinks.some((l) => l.studentId === sub.studentId)) throw new Error("Not your child's submission.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`documents/${session!.user.schoolId!}`, file.name, bytes);

  await sdb.homeworkSubmission.update({
    where: { id: submissionId },
    data: { attachmentPath: storagePath, status: sub.status === "PENDING" ? "SUBMITTED" : sub.status, submittedOn: sub.submittedOn ?? new Date() },
  });
  revalidatePath("/app/homework");
}

export async function updateHomeworkGraceDays(days: number | null) {
  const sid = await schoolId();
  await requireModuleAccess("Homework", "EDIT");
  const sdb = await getScopedDb();
  await sdb.school.update({ where: { id: sid }, data: { homeworkGraceDays: days } });
  revalidatePath("/app/homework");
}

/** Every still-pending (by due date, not yet submitted) homework item across a parent's linked students — for the overdue dashboard. */
export async function getOverdueHomework(studentIds: string[]) {
  const enabled = await hasFeature(await schoolId(), "homework.attachmentsAndDigest");
  if (!enabled || studentIds.length === 0) return [];

  const sdb = await getScopedDb();
  const overdue = await sdb.homeworkSubmission.findMany({
    where: { studentId: { in: studentIds }, status: "PENDING", assignment: { dueDate: { lt: new Date() } } },
    include: { assignment: { include: { subject: true } }, student: true },
    orderBy: { assignment: { dueDate: "asc" } },
  });

  return overdue.map((o) => ({
    id: o.id,
    studentName: `${o.student.firstName} ${o.student.surname}`,
    title: o.assignment.title,
    subject: o.assignment.subject.name,
    dueDate: o.assignment.dueDate.toISOString(),
  }));
}
