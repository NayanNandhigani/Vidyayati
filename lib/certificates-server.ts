import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

/**
 * Loads an issued certificate for viewing/downloading, enforcing access:
 * SCHOOL_ADMIN/STAFF need Certificates VIEW; PARENT must be linked to the
 * certificate's student. Throws on insufficient access (callers — a page
 * or a route handler — decide how to surface that), returns null only
 * when the id itself doesn't resolve to a row in this tenant.
 *
 * Kept out of lib/certificates.ts deliberately — that file is imported by
 * the client component GeneratePanel.tsx, and this one pulls in auth/db.
 */
export async function loadCertificateForViewer(id: string) {
  const session = await auth();
  const sdb = await getScopedDb();

  const cert = await sdb.certificateIssued.findFirst({
    where: { id },
    include: { student: { include: { class: true } }, template: true, school: true },
  });
  if (!cert) return null;

  if (session!.user.role === "PARENT") {
    const parent = await sdb.parent.findUnique({ where: { userId: session!.user.id }, include: { studentLinks: true } });
    const owns = parent?.studentLinks.some((l) => l.studentId === cert.studentId) ?? false;
    if (!owns) throw new Error("Not authorized to view this certificate.");
  } else {
    await requireModuleAccess("Certificates", "VIEW");
  }

  return cert;
}
