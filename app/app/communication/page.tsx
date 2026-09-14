import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import ComposeForm from "./ComposeForm";
import { PendingAnnouncementsPanel } from "./PendingAnnouncementsPanel";

const AUDIENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ALL_PARENTS: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)", label: "All Parents" },
  ALL_STAFF: { bg: "var(--teal-tint)", fg: "var(--teal)", label: "All Staff" },
  SPECIFIC_CLASS: { bg: "var(--info-tint)", fg: "var(--info)", label: "Specific Class" },
  SPECIFIC_STUDENT: { bg: "var(--info-tint)", fg: "var(--info)", label: "Specific Student" },
};

export default async function CommunicationPage() {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <RecipientView />;
  }

  const accessLevel = await requireModuleAccess("Communication", "VIEW");
  const canEdit = accessLevel === "EDIT";

  if (!canEdit) {
    return <RecipientView />;
  }

  const isAdmin = session!.user.role === "SCHOOL_ADMIN";

  const [announcements, pending, classes, students, totalParents, totalStaff] = await Promise.all([
    sdb.announcement.findMany({ where: { approvalStatus: "APPROVED" }, include: { reads: true }, orderBy: { publishedOn: "desc" }, take: 30 }),
    sdb.announcement.findMany({ where: { approvalStatus: "PENDING" }, orderBy: { createdAt: "desc" } }),
    sdb.class.findMany({ orderBy: [{ grade: "asc" }, { section: "asc" }] }),
    sdb.student.findMany({ where: { status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { surname: "asc" }], select: { id: true, firstName: true, surname: true } }),
    sdb.parent.count(),
    sdb.staffProfile.count(),
  ]);

  async function eligibleCount(a: (typeof announcements)[number]) {
    if (a.audienceType === "ALL_PARENTS") return totalParents;
    if (a.audienceType === "ALL_STAFF") return totalStaff;
    if (a.audienceType === "SPECIFIC_CLASS" && a.audienceTarget) {
      return sdb.studentParentLink.count({ where: { student: { classId: a.audienceTarget } } });
    }
    if (a.audienceType === "SPECIFIC_STUDENT" && a.audienceTarget) {
      return sdb.studentParentLink.count({ where: { studentId: a.audienceTarget } });
    }
    return 0;
  }

  const feed = await Promise.all(
    announcements.map(async (a) => ({
      id: a.id,
      title: a.title,
      audienceType: a.audienceType,
      publishedOn: a.publishedOn!,
      viewed: a.reads.length,
      eligible: await eligibleCount(a),
    }))
  );

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div>
        <div className="disp" style={{ fontSize: 21 }}>
          Communication
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>In-app announcements &amp; circulars</div>
      </div>

      <PendingAnnouncementsPanel
        items={pending.map((a) => ({ id: a.id, title: a.title, body: a.body, audienceType: a.audienceType, createdAt: a.createdAt.toISOString() }))}
        isAdmin={isAdmin}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1.28fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Past announcements</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{feed.length} published</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {feed.length === 0 && <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)" }}>No announcements published yet.</div>}
            {feed.map((a) => {
              const style = AUDIENCE_STYLE[a.audienceType];
              const pct = a.eligible ? Math.round((a.viewed / a.eligible) * 100) : 0;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="pill" style={{ background: style.bg, color: style.fg }}>
                        {style.label}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                        {a.publishedOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 118, flex: "none" }}>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                      {a.viewed}/{a.eligible} <span style={{ color: "var(--faint)", fontWeight: 500 }}>viewed</span>
                    </div>
                    <div style={{ height: 5, width: 100, background: "var(--line)", borderRadius: 3, marginTop: 6, marginLeft: "auto" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct >= 85 ? "var(--good)" : "var(--warn)", borderRadius: 3 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: "20px 22px", overflowY: "auto" }}>
          <ComposeForm classes={classes} students={students} />
        </div>
      </div>
    </div>
  );
}

async function RecipientView() {
  const session = await auth();
  const sdb = await getScopedDb();
  const role = session!.user.role;

  let audienceFilter: { OR: Array<Record<string, unknown>> };
  let classIdForFilter: string | null = null;
  let studentIds: string[] = [];

  if (role === "PARENT") {
    const parent = await sdb.parent.findUnique({ where: { userId: session!.user.id }, include: { studentLinks: { include: { student: true } } } });
    studentIds = parent?.studentLinks.map((l) => l.studentId) ?? [];
    const classIds = [...new Set(parent?.studentLinks.map((l) => l.student.classId) ?? [])];
    audienceFilter = {
      OR: [
        { audienceType: "ALL_PARENTS" },
        { audienceType: "SPECIFIC_CLASS", audienceTarget: { in: classIds } },
        { audienceType: "SPECIFIC_STUDENT", audienceTarget: { in: studentIds } },
      ],
    };
  } else {
    audienceFilter = { OR: [{ audienceType: "ALL_STAFF" }] };
  }

  const announcements = await sdb.announcement.findMany({
    where: { approvalStatus: "APPROVED", ...audienceFilter },
    orderBy: { publishedOn: "desc" },
    take: 30,
  });

  // Mark visible announcements as read for this user (idempotent).
  if (announcements.length > 0) {
    await sdb.announcementRead.createMany({
      data: announcements.map((a) => ({ announcementId: a.id, userId: session!.user.id, schoolId: session!.user.schoolId! })),
      skipDuplicates: true,
    });
  }

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Announcements
      </div>
      {announcements.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          No announcements yet.
        </div>
      ) : (
        <div className="card" style={{ padding: "8px 22px" }}>
          {announcements.map((a) => {
            const style = AUDIENCE_STYLE[a.audienceType];
            return (
              <div key={a.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</div>
                  <span className="pill" style={{ background: style.bg, color: style.fg }}>
                    {style.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 6 }}>{a.body}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
                  {a.publishedOn!.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
