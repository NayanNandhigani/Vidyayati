"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AccessLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PLATFORM_MODULES } from "@/lib/platform-modules";
import { createPendingAccount } from "@/lib/account-setup";

export type StaffFormState = { error?: string };
export type FormState = { error?: string; success?: boolean };

async function requireSuperAdmin() {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") {
    throw new Error("Only a Super Admin can manage platform staff and permissions.");
  }
  return session;
}

export async function createPlatformStaff(_prevState: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can add platform staff." };

  const name = formData.get("name");
  const username = formData.get("username");
  const phone = formData.get("phone");
  const title = formData.get("title");
  const department = formData.get("department");

  if (typeof name !== "string" || !name.trim() || typeof username !== "string" || !username.trim()) {
    return { error: "Name and username are required." };
  }

  const normalizedUsername = username.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { username: normalizedUsername } });
  if (existing) return { error: "A user with this username already exists." };

  const { token, setupTokenHash, setupTokenExpiresAt, placeholderHash } = await createPendingAccount();

  const user = await db.user.create({
    data: {
      name: name.trim(),
      username: normalizedUsername,
      phone: typeof phone === "string" && phone ? phone : null,
      role: "PLATFORM_STAFF",
      passwordHash: placeholderHash,
      setupTokenHash,
      setupTokenExpiresAt,
      platformStaffProfile: {
        create: {
          title: typeof title === "string" && title ? title : null,
          department: typeof department === "string" && department ? department : null,
          dateJoined: new Date(),
          permissions: { create: PLATFORM_MODULES.map((moduleName) => ({ moduleName, accessLevel: "NONE" as AccessLevel })) },
        },
      },
    },
  });

  revalidatePath("/super-admin/staff");
  redirect(`/super-admin/staff?staff=${user.id}&setupToken=${token}`);
}

export async function cyclePlatformPermission(staffId: string, moduleName: string) {
  await requireSuperAdmin();

  const CYCLE: AccessLevel[] = ["NONE", "VIEW", "EDIT"];
  const existing = await db.platformStaffPermission.findUnique({ where: { staffId_moduleName: { staffId, moduleName } } });
  const next = CYCLE[(CYCLE.indexOf(existing?.accessLevel ?? "NONE") + 1) % CYCLE.length];

  await db.platformStaffPermission.upsert({
    where: { staffId_moduleName: { staffId, moduleName } },
    update: { accessLevel: next },
    create: { staffId, moduleName, accessLevel: next },
  });

  revalidatePath("/super-admin/staff");
  return { accessLevel: next };
}

export async function togglePlatformStaffStatus(userId: string): Promise<FormState> {
  await requireSuperAdmin();

  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== "PLATFORM_STAFF") return { error: "Only platform staff accounts can be deactivated here." };

  await db.user.update({
    where: { id: userId },
    data: { status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/super-admin/staff");
  return { success: true };
}
