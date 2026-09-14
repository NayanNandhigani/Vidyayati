"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth, unstable_update } from "@/auth";
import { db } from "@/lib/db";
import { newPasswordSchema } from "@/lib/validation";

export type FormState = { error?: string; success?: boolean };

export async function updateAccount(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) return { error: "Name is required." };

  await db.user.update({ where: { id: session!.user.id }, data: { name: name.trim() } });
  revalidatePath("/super-admin/settings");
  return { success: true };
}

export async function changePassword(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return { error: "Enter your current and new password." };
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session!.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const parsed = newPasswordSchema.safeParse({ newPassword, username: user.username });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });

  await unstable_update({ user: { mustChangePassword: false } });

  return { success: true };
}
