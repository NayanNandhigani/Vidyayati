"use server";

import { revalidatePath } from "next/cache";
import { Prisma, MealType, HostelOutingStatus } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

async function guard() {
  await requireModuleAccess("Hostel", "EDIT");
}

export async function updateRoomTypeAndWarden(roomId: string, roomType: string | null, wardenStaffId: string | null) {
  await guard();
  const sdb = await getScopedDb();
  if (wardenStaffId) await sdb.staffProfile.findUniqueOrThrow({ where: { id: wardenStaffId }, select: { id: true } });
  await sdb.hostelRoom.update({ where: { id: roomId }, data: { roomType, wardenStaffId } });
  revalidatePath("/app/hostel");
}

export async function upsertMessMenu(dayOfWeek: number, mealType: MealType, menuText: string) {
  await guard();
  const sid = await schoolId();
  const sdb = await getScopedDb();
  await sdb.hostelMessMenu.upsert({
    where: { schoolId_dayOfWeek_mealType: { schoolId: sid, dayOfWeek, mealType } },
    create: scopedCreateData<Prisma.HostelMessMenuUncheckedCreateInput>({ dayOfWeek, mealType, menuText: menuText.trim() }),
    update: { menuText: menuText.trim() },
  });
  revalidatePath("/app/hostel");
}

export async function addVisitorLog(studentId: string, visitorName: string, relation: string | null, purpose: string | null) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } });
  await sdb.hostelVisitorLog.create({
    data: scopedCreateData<Prisma.HostelVisitorLogUncheckedCreateInput>({ studentId, visitorName: visitorName.trim(), relation, purpose }),
  });
  revalidatePath("/app/hostel");
}

export async function checkOutVisitor(logId: string) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.hostelVisitorLog.update({ where: { id: logId }, data: { checkOutAt: new Date() } });
  revalidatePath("/app/hostel");
}

/** Parent requests an outing for their hostel-resident child — no module-access check, a parent isn't Staff/Admin. */
export async function requestOuting(studentId: string, reason: string, dateFrom: string, dateTo: string) {
  const session = await auth();
  if (session!.user.role !== "PARENT") throw new Error("Only a parent can submit an outing request.");

  const sdb = await getScopedDb();
  const parent = await sdb.parent.findUnique({ where: { userId: session!.user.id }, include: { studentLinks: true } });
  if (!parent?.studentLinks.some((l) => l.studentId === studentId)) throw new Error("Not your child.");

  await sdb.hostelOutingRequest.create({
    data: scopedCreateData<Prisma.HostelOutingRequestUncheckedCreateInput>({
      studentId,
      reason: reason.trim(),
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
    }),
  });
  revalidatePath("/app/hostel");
}

export async function actOnOuting(requestId: string, approve: boolean) {
  await guard();
  const sdb = await getScopedDb();
  await sdb.hostelOutingRequest.update({
    where: { id: requestId },
    data: { status: approve ? HostelOutingStatus.APPROVED : HostelOutingStatus.REJECTED, actionAt: new Date() },
  });
  revalidatePath("/app/hostel");
}
