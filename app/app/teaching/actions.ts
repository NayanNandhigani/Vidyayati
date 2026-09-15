"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

async function currentStaffId(): Promise<string | null> {
  const session = await auth();
  if (session?.user.role !== "STAFF") return null;
  const staff = await db.staffProfile.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  return staff?.id ?? null;
}

export type TeachingActionState = { error?: string };

export async function addSyllabusTopic(classId: string, subjectId: string, title: string): Promise<TeachingActionState> {
  if (!title.trim()) return { error: "Topic title is required." };

  await requireModuleAccess("Teaching", "EDIT", classId);
  const sdb = await getScopedDb();

  // classId/subjectId are client-supplied — confirm they belong to this
  // school before creating anything against them.
  const cls = await sdb.class.findUnique({ where: { id: classId }, select: { id: true } });
  if (!cls) return { error: "That class could not be found." };
  const subject = await sdb.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return { error: "That subject could not be found." };

  const last = await sdb.syllabusTopic.findFirst({
    where: { classId, subjectId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  await sdb.syllabusTopic.create({
    data: scopedCreateData<Prisma.SyllabusTopicUncheckedCreateInput>({
      classId,
      subjectId,
      title: title.trim(),
      orderIndex: (last?.orderIndex ?? -1) + 1,
    }),
  });

  revalidatePath("/app/teaching");
  return {};
}

export async function markTopicCovered(topicId: string, coveredOn: string, note: string): Promise<TeachingActionState> {
  const sdb = await getScopedDb();
  const topic = await sdb.syllabusTopic.findUniqueOrThrow({ where: { id: topicId }, select: { classId: true } });
  await requireModuleAccess("Teaching", "EDIT", topic.classId);

  const staffId = await currentStaffId();
  const parsedDate = coveredOn ? new Date(coveredOn) : new Date();
  if (Number.isNaN(parsedDate.getTime())) return { error: "That date isn't valid." };

  await sdb.syllabusTopic.update({
    where: { id: topicId },
    data: {
      status: "COMPLETED",
      coveredOn: parsedDate,
      note: note.trim() || null,
      loggedByStaffId: staffId,
    },
  });

  revalidatePath("/app/teaching");
  return {};
}

export async function reopenTopic(topicId: string) {
  const sdb = await getScopedDb();
  const topic = await sdb.syllabusTopic.findUniqueOrThrow({ where: { id: topicId }, select: { classId: true } });
  await requireModuleAccess("Teaching", "EDIT", topic.classId);

  await sdb.syllabusTopic.update({
    where: { id: topicId },
    data: { status: "PLANNED", coveredOn: null, note: null, loggedByStaffId: null },
  });

  revalidatePath("/app/teaching");
}

export async function deleteSyllabusTopic(topicId: string) {
  const sdb = await getScopedDb();
  const topic = await sdb.syllabusTopic.findUniqueOrThrow({ where: { id: topicId }, select: { classId: true } });
  await requireModuleAccess("Teaching", "EDIT", topic.classId);

  await sdb.syllabusTopic.delete({ where: { id: topicId } });
  revalidatePath("/app/teaching");
}

export async function reorderTopic(topicId: string, direction: "up" | "down") {
  const sdb = await getScopedDb();
  const topic = await sdb.syllabusTopic.findUniqueOrThrow({ where: { id: topicId } });
  await requireModuleAccess("Teaching", "EDIT", topic.classId);

  const neighbor = await sdb.syllabusTopic.findFirst({
    where: {
      classId: topic.classId,
      subjectId: topic.subjectId,
      orderIndex: direction === "up" ? { lt: topic.orderIndex } : { gt: topic.orderIndex },
    },
    orderBy: { orderIndex: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;

  await sdb.$transaction([
    sdb.syllabusTopic.update({ where: { id: topic.id }, data: { orderIndex: neighbor.orderIndex } }),
    sdb.syllabusTopic.update({ where: { id: neighbor.id }, data: { orderIndex: topic.orderIndex } }),
  ]);

  revalidatePath("/app/teaching");
}
