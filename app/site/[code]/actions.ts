"use server";

import { revalidatePath } from "next/cache";
import { Prisma, WebsiteElementType } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { saveUploadedFile, deleteUploadedFile } from "@/lib/storage";

async function requireAdmin() {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") throw new Error("Only a School Admin can edit the website.");
}

const DEFAULT_CONTENT: Record<WebsiteElementType, { text?: string; width: number; height: number; fontSize?: number; shapeKind?: string }> = {
  TEXT: { text: "New text", width: 300, height: 40, fontSize: 16 },
  BUTTON: { text: "Button", width: 160, height: 44, fontSize: 14 },
  IMAGE: { width: 200, height: 150 },
  IMAGE_CAROUSEL: { width: 800, height: 160 },
  SHAPE: { width: 160, height: 160, shapeKind: "rectangle" },
};

export async function addElement(code: string, type: WebsiteElementType, box: { x: number; y: number }) {
  await requireAdmin();
  const sdb = await getScopedDb();
  const defaults = DEFAULT_CONTENT[type];

  await sdb.websiteElement.create({
    data: scopedCreateData<Prisma.WebsiteElementUncheckedCreateInput>({
      type,
      x: box.x,
      y: box.y,
      width: defaults.width,
      height: defaults.height,
      text: defaults.text,
      fontSize: defaults.fontSize,
      shapeKind: defaults.shapeKind,
      backgroundColor: type === "BUTTON" || type === "SHAPE" ? "#e08a2c" : null,
      color: type === "BUTTON" ? "#ffffff" : null,
      borderColor: type === "SHAPE" ? "#e08a2c" : null,
      borderWidth: type === "SHAPE" ? 0 : null,
      borderRadius: type === "SHAPE" ? 8 : null,
    }),
  });

  revalidatePath(`/site/${code}`);
}

export async function updateElementBox(code: string, id: string, box: { x: number; y: number; width: number; height: number }) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.websiteElement.update({ where: { id }, data: box });
  revalidatePath(`/site/${code}`);
}

export async function updateElementText(code: string, id: string, text: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.websiteElement.update({ where: { id }, data: { text } });
  revalidatePath(`/site/${code}`);
}

export async function updateElementHref(code: string, id: string, href: string) {
  await requireAdmin();
  const sdb = await getScopedDb();
  await sdb.websiteElement.update({ where: { id }, data: { href: href.trim() || null } });
  revalidatePath(`/site/${code}`);
}

export async function updateElementStyle(
  code: string,
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
  await sdb.websiteElement.update({ where: { id }, data: style });
  revalidatePath(`/site/${code}`);
}

export async function replaceElementImage(code: string, id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;

  const existing = await sdb.websiteElement.findUnique({ where: { id } });
  const bytes = Buffer.from(await file.arrayBuffer());
  const { storagePath } = await saveUploadedFile(`website/${session!.user.schoolId!}`, file.name, bytes);
  if (existing?.imagePath) await deleteUploadedFile(existing.imagePath);

  await sdb.websiteElement.update({ where: { id }, data: { imagePath: storagePath } });
  revalidatePath(`/site/${code}`);
}

export async function addCarouselImages(code: string, id: string, formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  const existing = await sdb.websiteElement.findUnique({ where: { id } });
  if (!existing) return;

  const images = [...existing.images];
  const newPhotos = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  for (const photo of newPhotos) {
    const bytes = Buffer.from(await photo.arrayBuffer());
    const { storagePath } = await saveUploadedFile(`website/${session!.user.schoolId!}`, photo.name, bytes);
    images.push(storagePath);
  }

  await sdb.websiteElement.update({ where: { id }, data: { images } });
  revalidatePath(`/site/${code}`);
}

export async function removeCarouselImage(code: string, id: string, imagePath: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const existing = await sdb.websiteElement.findUnique({ where: { id } });
  if (!existing) return;

  await sdb.websiteElement.update({ where: { id }, data: { images: existing.images.filter((p) => p !== imagePath) } });
  await deleteUploadedFile(imagePath);
  revalidatePath(`/site/${code}`);
}

export async function deleteElement(code: string, id: string) {
  await requireAdmin();
  const sdb = await getScopedDb();

  const existing = await sdb.websiteElement.findUnique({ where: { id } });
  if (existing?.imagePath) await deleteUploadedFile(existing.imagePath);
  await Promise.all((existing?.images ?? []).map((path) => deleteUploadedFile(path)));
  await sdb.websiteElement.delete({ where: { id } });

  revalidatePath(`/site/${code}`);
}

export async function updateCanvasBackground(code: string, color: string) {
  await requireAdmin();
  const session = await auth();
  const sdb = await getScopedDb();

  await sdb.websiteSettings.upsert({
    where: { schoolId: session!.user.schoolId! },
    update: { canvasBackground: color },
    create: scopedCreateData<Prisma.WebsiteSettingsUncheckedCreateInput>({ canvasBackground: color }),
  });

  revalidatePath(`/site/${code}`);
}

/**
 * Copies the live, currently-being-edited website_elements + canvas
 * background into WebsiteSettings.publishedSnapshot — the one thing the
 * public (non-admin) render of this route actually reads. Every other
 * action here writes the live rows so the admin sees their own edits
 * immediately; only this one affects what a visitor sees, and only when
 * explicitly called (the "Publish" button), not on every edit.
 */
export async function publishWebsite(code: string) {
  await requireAdmin();
  const session = await auth();
  const schoolId = session!.user.schoolId!;
  const sdb = await getScopedDb();

  const [elements, settings] = await Promise.all([
    sdb.websiteElement.findMany({ where: { schoolId }, orderBy: { zIndex: "asc" } }),
    sdb.websiteSettings.findUnique({ where: { schoolId } }),
  ]);

  const snapshot = {
    canvasBackground: settings?.canvasBackground ?? null,
    elements: elements.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      visible: e.visible,
      text: e.text,
      href: e.href,
      imagePath: e.imagePath,
      images: e.images,
      fontSize: e.fontSize,
      fontFamily: e.fontFamily,
      fontWeight: e.fontWeight,
      italic: e.italic,
      textAlign: e.textAlign,
      color: e.color,
      backgroundColor: e.backgroundColor,
      shapeKind: e.shapeKind,
      borderColor: e.borderColor,
      borderWidth: e.borderWidth,
      borderRadius: e.borderRadius,
    })),
  };

  await sdb.websiteSettings.upsert({
    where: { schoolId },
    update: { publishedSnapshot: snapshot, publishedAt: new Date() },
    create: scopedCreateData<Prisma.WebsiteSettingsUncheckedCreateInput>({ publishedSnapshot: snapshot, publishedAt: new Date() }),
  });

  revalidatePath(`/site/${code}`);
  return { publishedAt: new Date().toISOString() };
}
