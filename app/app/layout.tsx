import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { scopedDb, scopedCreateData } from "@/lib/tenant-db";
import { moduleLabelForPath } from "@/components/sidebar-config";
import Sidebar from "@/components/Sidebar";
import { signOutAction } from "./actions";
import { hasFeature } from "@/lib/feature-flags";
import type { Prisma } from "@prisma/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || !session.user.schoolId) {
    redirect("/login");
  }

  const school = await db.school.findUniqueOrThrow({
    where: { id: session.user.schoolId },
    select: { name: true, disabledModules: true },
  });
  const disabledSchoolModules = new Set(school.disabledModules);
  // Inventory is a whole new module (Batch 14), not an existing one — gate
  // its sidebar entry behind the Super Admin feature flag entirely, same
  // hidden-until-granted default as every other "depth" feature, rather
  // than adding a second nav-visibility mechanism.
  if (!(await hasFeature(session.user.schoolId, "inventory.module"))) {
    disabledSchoolModules.add("Inventory");
  }

  const pathname = (await headers()).get("x-pathname");
  const moduleLabel = pathname ? moduleLabelForPath(pathname) : null;
  if (moduleLabel) {
    const sdb = scopedDb(session.user.schoolId, session.user.id);
    sdb.activityLog
      .create({ data: scopedCreateData<Prisma.ActivityLogUncheckedCreateInput>({ userId: session.user.id, type: "PAGE_VIEW", module: moduleLabel }) })
      .catch(() => {});
  }

  let visibleModules: Set<string> | null = null;
  if (session.user.role === "STAFF") {
    const staff = await db.staffProfile.findUnique({
      where: { userId: session.user.id },
      include: { permissions: { where: { accessLevel: { not: "NONE" } } } },
    });
    visibleModules = new Set(staff?.permissions.map((p) => p.moduleName) ?? []);
  }

  return (
    <div style={{ display: "flex" }}>
      <Sidebar
        role={session.user.role as "SCHOOL_ADMIN" | "STAFF" | "PARENT"}
        visibleModules={visibleModules}
        disabledSchoolModules={disabledSchoolModules}
        schoolName={school.name}
        userName={session.user.name ?? "User"}
        onSignOut={signOutAction}
      />
      <div style={{ flex: 1, minWidth: 0, background: "var(--paper)" }}>{children}</div>
    </div>
  );
}
