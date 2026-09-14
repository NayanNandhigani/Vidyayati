import { AccessLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { auth } from "@/auth";

const LEVEL_RANK: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
};

/**
 * Staff permissions are per-module (see StaffPermission), not a fixed
 * "Teacher" role — call this from a module's pages/server actions to check
 * the current user can access it. School Admins implicitly have EDIT access
 * to everything (the top of the two-tier View/Edit ladder). Throws if the
 * session is missing or access is insufficient.
 *
 * `classId`, when the module is one of the class-scoped ones (Students,
 * Attendance, Exams, Homework, Timetable), checks access to that specific
 * class. Resolution order: a school-wide row (StaffPermission.classId ===
 * null) for the module wins regardless of which class was requested — an
 * admin granting blanket access to a module shouldn't need one row per
 * class. Otherwise, a row scoped to exactly the requested classId is used.
 * No matching row → NONE, same as today. Omitting `classId` entirely only
 * ever resolves the school-wide row — callers doing a class-scoped action
 * must pass it.
 */
export async function requireModuleAccess(
  moduleName: string,
  minimum: AccessLevel = "VIEW",
  classId?: string
): Promise<AccessLevel> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  if (session.user.schoolId) {
    const school = await db.school.findUnique({ where: { id: session.user.schoolId }, select: { disabledModules: true } });
    if (school?.disabledModules.includes(moduleName)) {
      throw new Error(`Module "${moduleName}" is disabled for this school`);
    }
  }

  if (session.user.role === "SCHOOL_ADMIN") {
    return "EDIT";
  }

  if (session.user.role !== "STAFF") {
    throw new Error(`Role ${session.user.role} cannot access module "${moduleName}"`);
  }

  const staffProfile = await db.staffProfile.findUnique({
    where: { userId: session.user.id },
    include: { permissions: { where: { moduleName } } },
  });

  const rows = staffProfile?.permissions ?? [];
  const schoolWide = rows.find((p) => p.classId === null);
  const classSpecific = classId ? rows.find((p) => p.classId === classId) : undefined;
  const level = schoolWide?.accessLevel ?? classSpecific?.accessLevel ?? "NONE";

  if (LEVEL_RANK[level] < LEVEL_RANK[minimum]) {
    throw new Error(
      `Insufficient permission for module "${moduleName}": has ${level}, needs ${minimum}`
    );
  }
  return level;
}

/**
 * For the class-scoped modules' list views: which classes can the current
 * session see/act on for this module, at at least `minimum`? "ALL" means a
 * school-wide grant at or above that level — don't bother filtering by
 * class. School Admins always get "ALL". Returns an empty Set (not "ALL")
 * for a Staff session with no qualifying access at all.
 */
export async function getPermittedClassIds(moduleName: string, minimum: AccessLevel = "VIEW"): Promise<"ALL" | Set<string>> {
  const session = await auth();
  if (!session?.user) return new Set();
  if (session.user.role === "SCHOOL_ADMIN") return "ALL";
  if (session.user.role !== "STAFF") return new Set();

  const staffProfile = await db.staffProfile.findUnique({
    where: { userId: session.user.id },
    include: { permissions: { where: { moduleName } } },
  });

  const rows = (staffProfile?.permissions ?? []).filter((p) => LEVEL_RANK[p.accessLevel] >= LEVEL_RANK[minimum]);
  if (rows.some((p) => p.classId === null)) return "ALL";
  return new Set(rows.map((p) => p.classId).filter((id): id is string => id !== null));
}

/**
 * Same idea as requireModuleAccess, but for the Super Admin portal's own
 * team (PlatformStaffPermission) rather than a school's. A SUPER_ADMIN
 * session implicitly has EDIT access to every platform module; a
 * PLATFORM_STAFF session is checked against its per-module grant. Throws if
 * the session is missing or access is insufficient.
 */
export async function requirePlatformModuleAccess(
  moduleName: string,
  minimum: AccessLevel = "VIEW"
): Promise<AccessLevel> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  if (session.user.role === "SUPER_ADMIN") {
    return "EDIT";
  }

  if (session.user.role !== "PLATFORM_STAFF") {
    throw new Error(`Role ${session.user.role} cannot access platform module "${moduleName}"`);
  }

  const staffProfile = await db.platformStaffProfile.findUnique({
    where: { userId: session.user.id },
    include: { permissions: { where: { moduleName } } },
  });

  const level = staffProfile?.permissions[0]?.accessLevel ?? "NONE";
  if (LEVEL_RANK[level] < LEVEL_RANK[minimum]) {
    throw new Error(
      `Insufficient permission for platform module "${moduleName}": has ${level}, needs ${minimum}`
    );
  }
  return level;
}

/** Full map of a platform-staff session's per-module access, for building nav/UI. SUPER_ADMIN gets EDIT everywhere. */
export async function getPlatformPermissionMap(): Promise<Record<string, AccessLevel> | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.role === "SUPER_ADMIN") return null; // null == unrestricted, caller should treat every module as EDIT

  const staffProfile = await db.platformStaffProfile.findUnique({
    where: { userId: session.user.id },
    include: { permissions: true },
  });
  const map: Record<string, AccessLevel> = {};
  for (const p of staffProfile?.permissions ?? []) map[p.moduleName] = p.accessLevel;
  return map;
}
