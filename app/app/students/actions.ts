"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, Gender } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { enrollStudent } from "@/lib/domain/enrollment";

export type StudentFormState = { error?: string };

export async function createStudent(_prevState: StudentFormState, formData: FormData): Promise<StudentFormState> {
  const firstName = formData.get("firstName");
  const surname = formData.get("surname");
  const admissionNo = formData.get("admissionNo");
  const classId = formData.get("classId");
  const dob = formData.get("dob");
  const gender = formData.get("gender");

  if (
    typeof firstName !== "string" || !firstName.trim() ||
    typeof surname !== "string" || !surname.trim() ||
    typeof admissionNo !== "string" || !admissionNo.trim() ||
    typeof classId !== "string" || !classId
  ) {
    return { error: "First name, surname, admission number, and class are required." };
  }

  await requireModuleAccess("Students", "EDIT", classId);
  const sdb = await getScopedDb();
  await sdb.class.findUniqueOrThrow({ where: { id: classId }, select: { id: true } });

  const session = await auth();
  const school = await db.school.findUnique({ where: { id: session!.user.schoolId! }, select: { maxStudents: true } });
  if (school?.maxStudents != null) {
    const activeCount = await sdb.student.count({ where: { status: "ACTIVE" } });
    if (activeCount >= school.maxStudents) {
      return { error: `This school's student limit (${school.maxStudents}) has been reached. Contact Vidya Yati to raise it.` };
    }
  }

  let student;
  try {
    student = await sdb.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: scopedCreateData<Prisma.StudentUncheckedCreateInput>({
          firstName: firstName.trim(),
          surname: surname.trim(),
          admissionNo: admissionNo.trim(),
          classId,
          dob: typeof dob === "string" && dob ? new Date(dob) : null,
          gender: typeof gender === "string" && gender ? (gender as Gender) : null,
        }),
      });
      await enrollStudent(student.id, classId, undefined, tx);
      return student;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A student with this admission number already exists in this class." };
    }
    throw e;
  }

  revalidatePath("/app/students");
  redirect(`/app/students/${student.id}`);
}

// The client already asks the admin to confirm before calling this — see
// the confirm() gate in StudentFeeAllocationPanel — since it changes this
// student's recorded scholarship (the class's actual fee, from Academic
// Management → Fee Structure, minus this charged fee).
export async function updateStudentChargedFee(studentId: string, chargedFee: number | null) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can change a student's charged fee.");
  const sdb = await getScopedDb();

  const student = await sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { classId: true } });
  const cls = await sdb.class.findUniqueOrThrow({ where: { id: student.classId }, select: { grade: true, yearId: true } });
  const feeDefault = await sdb.classFeeDefault.findUnique({ where: { yearId_grade: { yearId: cls.yearId, grade: cls.grade } } });
  if (chargedFee != null && feeDefault && chargedFee > Number(feeDefault.actualFee)) {
    throw new Error("Charged fee can't be more than the actual fee.");
  }

  await sdb.student.update({ where: { id: studentId }, data: { chargedFee } });
  revalidatePath(`/app/students/${studentId}`);
}
