"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, IdCardAudience, IdCardOrientation, IdCardElementType } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage";
import { CARD_SIZE } from "@/lib/id-cards";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can edit ID card templates.");
}

const BASE = "/app/settings?panel=idcards";

// A blank canvas reads like a stub — every new template starts with a
// small, sensible starter layout the admin can then drag around, matching
// the old prototype's look (photo top-left, name + id below it) rather
// than an empty rectangle.
function starterElements(audience: IdCardAudience): Array<Omit<Prisma.IdCardElementUncheckedCreateInput, "templateId">> {
  const nameToken = audience === "STAFF" ? "{{staffName}}" : "{{studentName}}";
  const idToken = audience === "STAFF" ? "{{designation}}" : "{{admissionNo}}";
  return [
    { type: IdCardElementType.TEXT, x: 14, y: 12, width: 200, height: 22, text: "{{schoolName}}", fontSize: 13, fontWeight: 700, color: "#ffffff" },
    { type: IdCardElementType.PHOTO, x: 14, y: 44, width: 72, height: 72, shapeKind: "rectangle", backgroundColor: "#ffffff", borderRadius: 8 },
    { type: IdCardElementType.TEXT, x: 96, y: 50, width: 220, height: 24, text: nameToken, fontSize: 15, fontWeight: 700, color: "#ffffff" },
    { type: IdCardElementType.TEXT, x: 96, y: 76, width: 220, height: 18, text: idToken, fontSize: 11, color: "#ffffff", fontFamily: "'IBM Plex Mono', monospace" },
  ];
}

export async function createIdCardTemplate(name: string, audience: IdCardAudience, orientation: IdCardOrientation) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const template = await sdb.idCardTemplate.create({
    data: scopedCreateData<Prisma.IdCardTemplateUncheckedCreateInput>({
      name: name.trim() || "Untitled template",
      audience,
      orientation,
      backgroundColor: "#e08a2c",
    }),
  });

  for (const el of starterElements(audience)) {
    await sdb.idCardElement.create({ data: { ...el, templateId: template.id } });
  }

  revalidatePath(BASE);
  redirect(`/app/settings/id-cards/${template.id}`);
}

export async function deleteIdCardTemplate(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const elements = await sdb.idCardElement.findMany({ where: { templateId: id } });
  await Promise.all(elements.map((e) => (e.imagePath ? deleteUploadedFile(e.imagePath) : Promise.resolve())));
  await sdb.idCardTemplate.delete({ where: { id } });

  revalidatePath(BASE);
}

export async function setActiveTemplate(id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const template = await sdb.idCardTemplate.findUniqueOrThrow({ where: { id } });
  await sdb.idCardTemplate.updateMany({ where: { audience: template.audience, isActive: true }, data: { isActive: false } });
  await sdb.idCardTemplate.update({ where: { id }, data: { isActive: true } });

  revalidatePath(BASE);
}

export async function renameTemplate(id: string, name: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.idCardTemplate.update({ where: { id }, data: { name: name.trim() || "Untitled template" } });
  revalidatePath(`/app/settings/id-cards/${id}`);
}

export async function updateTemplateBackground(id: string, backgroundColor: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.idCardTemplate.update({ where: { id }, data: { backgroundColor } });
  revalidatePath(`/app/settings/id-cards/${id}`);
}

export async function updateTemplateOrientation(id: string, orientation: IdCardOrientation) {
  await requireAdmin();
  const sdb = await getScopedDb();
  const { width, height } = CARD_SIZE[orientation];
  const prevOrientation = orientation === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
  const prevSize = CARD_SIZE[prevOrientation];

  await sdb.idCardTemplate.update({ where: { id }, data: { orientation } });

  // Rescale every element proportionally so flipping orientation doesn't
  // leave elements hanging off the edge of the now-narrower/shorter card.
  const elements = await sdb.idCardElement.findMany({ where: { templateId: id } });
  const scaleX = width / prevSize.width;
  const scaleY = height / prevSize.height;
  await Promise.all(
    elements.map((e) =>
      sdb.idCardElement.update({
        where: { id: e.id },
        data: {
          x: Math.round(e.x * scaleX),
          y: Math.round(e.y * scaleY),
          width: Math.round(e.width * scaleX),
          height: Math.round(e.height * scaleY),
        },
      })
    )
  );

  revalidatePath(`/app/settings/id-cards/${id}`);
}

const DEFAULT_CONTENT: Record<IdCardElementType, { text?: string; width: number; height: number; fontSize?: number; shapeKind?: string }> = {
  TEXT: { text: "New text", width: 140, height: 22, fontSize: 12 },
  IMAGE: { width: 80, height: 40 },
  PHOTO: { width: 72, height: 72, shapeKind: "rectangle" },
  SHAPE: { width: 60, height: 60, shapeKind: "rectangle" },
  BARCODE: { text: "{{admissionNo}}", width: 60, height: 60 },
};

export async function addIdCardElement(templateId: string, type: IdCardElementType, box: { x: number; y: number }) {
  await requireAdmin();
  const sdb = await getScopedDb();
  const defaults = DEFAULT_CONTENT[type];

  await sdb.idCardElement.create({
    data: {
      templateId,
      type,
      x: box.x,
      y: box.y,
      width: defaults.width,
      height: defaults.height,
      text: defaults.text,
      fontSize: defaults.fontSize,
      shapeKind: defaults.shapeKind,
      backgroundColor: type === "SHAPE" || type === "PHOTO" ? "#e2e8f0" : null,
      borderColor: type === "SHAPE" ? "#94765a" : null,
      borderWidth: type === "SHAPE" ? 0 : null,
      borderRadius: type === "SHAPE" || type === "PHOTO" ? 8 : null,
    },
  });

  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

export async function updateIdCardElementBox(templateId: string, id: string, box: { x: number; y: number; width: number; height: number }) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.idCardElement.update({ where: { id }, data: box });
  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

export async function updateIdCardElementText(templateId: string, id: string, text: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.idCardElement.update({ where: { id }, data: { text } });
  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

export async function updateIdCardElementStyle(
  templateId: string,
  id: string,
  style: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
    italic?: boolean;
    textAlign?: string;
    color?: string;
    backgroundColor?: string;
    shapeKind?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
  }
) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.idCardElement.update({ where: { id }, data: style });
  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

export async function replaceIdCardElementImage(templateId: string, id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;

  const existing = await sdb.idCardElement.findUnique({ where: { id } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`idcards/${session!.user.schoolId!}`, file.name, bytes);
  if (existing?.imagePath) await deleteUploadedFile(existing.imagePath);

  await sdb.idCardElement.update({ where: { id }, data: { imagePath: storagePath } });
  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

export async function deleteIdCardElement(templateId: string, id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const existing = await sdb.idCardElement.findUnique({ where: { id } });
  if (existing?.imagePath) await deleteUploadedFile(existing.imagePath);
  await sdb.idCardElement.delete({ where: { id } });

  revalidatePath(`/app/settings/id-cards/${templateId}`);
}

// ---- Preview-with-a-real-person + setting their photo ----

export async function listStudentsForPreview() {
  await requireAdmin();
  const sdb = await getScopedDb();
  const students = await sdb.student.findMany({
    where: { status: "ACTIVE" },
    include: { class: true },
    orderBy: [{ firstName: "asc" }],
    take: 500,
  });
  return students.map((s) => ({ id: s.id, label: `${s.firstName} ${s.surname} — Grade ${s.class.grade}-${s.class.section} (${s.admissionNo})` }));
}

export async function listStaffForPreview() {
  await requireAdmin();
  const sdb = await getScopedDb();
  const staff = await sdb.staffProfile.findMany({ include: { user: true }, orderBy: { user: { name: "asc" } }, take: 500 });
  return staff.map((s) => ({ id: s.id, label: `${s.user.name}${s.designation ? " — " + s.designation : ""}` }));
}

export async function getStudentCardContext(studentId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  const session = await auth();
  const [student, school] = await Promise.all([
    sdb.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { class: true, parentLinks: { include: { parent: true } } },
    }),
    sdb.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! } }),
  ]);

  const guardian =
    student.parentLinks.find((l) => l.relation === "FATHER") ??
    student.parentLinks.find((l) => l.relation === "MOTHER") ??
    student.parentLinks[0];

  const { studentMergeContext } = await import("@/lib/id-cards");
  const ctx = studentMergeContext(student, school, guardian ? { name: guardian.parent.name, phone: guardian.parent.phone } : null);
  return { ctx, photoPath: student.photoPath };
}

export async function getStaffCardContext(staffId: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  const session = await auth();
  const [staff, school] = await Promise.all([
    sdb.staffProfile.findUniqueOrThrow({ where: { id: staffId }, include: { user: true } }),
    sdb.school.findUniqueOrThrow({ where: { id: session!.user.schoolId! } }),
  ]);

  const { staffMergeContext } = await import("@/lib/id-cards");
  const ctx = staffMergeContext(staff, school);
  return { ctx, photoPath: staff.photoPath };
}

export async function setStudentPhoto(studentId: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const existing = await sdb.student.findUnique({ where: { id: studentId } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`idcards/${session!.user.schoolId!}`, file.name, bytes);
  if (existing?.photoPath) await deleteUploadedFile(existing.photoPath);

  await sdb.student.update({ where: { id: studentId }, data: { photoPath: storagePath } });
  revalidatePath("/app/students");
  revalidatePath(`/app/students/${studentId}`);
}

export async function setStaffPhoto(staffId: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const existing = await sdb.staffProfile.findUnique({ where: { id: staffId } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`idcards/${session!.user.schoolId!}`, file.name, bytes);
  if (existing?.photoPath) await deleteUploadedFile(existing.photoPath);

  await sdb.staffProfile.update({ where: { id: staffId }, data: { photoPath: storagePath } });
  revalidatePath("/app/employees");
  revalidatePath(`/app/employees/${staffId}`);
}
