"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { hashSetupToken } from "@/lib/account-setup";

export type SetupAccountState = { error?: string; success?: boolean };

export async function completeAccountSetup(_prevState: SetupAccountState, formData: FormData): Promise<SetupAccountState> {
  const token = formData.get("token");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (typeof token !== "string" || !token) return { error: "Missing setup link." };
  if (typeof newPassword !== "string" || newPassword.length < 8) return { error: "Password must be at least 8 characters." };
  if (newPassword !== confirmPassword) return { error: "Passwords don't match." };

  const tokenHash = hashSetupToken(token);
  const user = await db.user.findUnique({ where: { setupTokenHash: tokenHash } });
  if (!user) return { error: "This setup link is invalid or has already been used." };
  if (!user.setupTokenExpiresAt || user.setupTokenExpiresAt < new Date()) {
    return { error: "This setup link has expired. Ask whoever created your account to generate a new one." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, setupTokenHash: null, setupTokenExpiresAt: null, mustChangePassword: false },
  });

  return { success: true };
}
