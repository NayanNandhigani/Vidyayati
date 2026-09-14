import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { daysUntil } from "@/lib/format";
import EventDetail from "./EventDetail";

const TYPE_COLOR: Record<string, { bg: string; fg: string }> = {
  Sports: { bg: "var(--teal-tint)", fg: "var(--teal)" },
  Academic: { bg: "var(--warn-tint)", fg: "var(--warn)" },
  Cultural: { bg: "var(--marigold-tint)", fg: "var(--marigold-deep)" },
  National: { bg: "var(--clay-tint)", fg: "var(--clay)" },
};
function typeStyle(type: string | null) {
  return (type && TYPE_COLOR[type]) || { bg: "var(--line)", fg: "var(--muted)" };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await auth();
  const params = await searchParams;
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentEventsView />;
  }

  const accessLevel = await requireModuleAccess("Events", "VIEW");
  const canEdit = accessLevel === "EDIT";

  const events = await sdb.event.findMany({ include: { checklistItems: true }, orderBy: { date: "asc" } });
  const now = new Date();
  const upcoming = events.filter((e) => e.date >= now);
  const completed = events.filter((e) => e.date < now);
  const nextEvent = upcoming[0];

  const selected = events.find((e) => e.id === params.event) ?? nextEvent ?? events[0];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          School events
        </div>
        {canEdit && (
          <Link href="/app/events/new" style={{ background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            + New event
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: 24, fontSize: 13, alignItems: "center" }}>
        <div>
          <span style={{ color: "var(--muted)" }}>Events this year</span> <span className="mono" style={{ fontWeight: 700 }}>{events.length}</span>
        </div>
        <div style={{ color: "var(--faint)" }}>·</div>
        <div>
          <span style={{ color: "var(--muted)" }}>Upcoming</span> <span className="mono" style={{ fontWeight: 700 }}>{upcoming.length}</span>
        </div>
        <div style={{ color: "var(--faint)" }}>·</div>
        <div>
          <span style={{ color: "var(--muted)" }}>Completed</span> <span className="mono" style={{ fontWeight: 700 }}>{completed.length}</span>
        </div>
        {nextEvent && (
          <div style={{ marginLeft: "auto", color: "var(--muted)" }}>
            Next up <span style={{ fontWeight: 700, color: "var(--ink)" }}>{nextEvent.title}</span> ·{" "}
            <span className="mono" style={{ color: "var(--marigold-deep)", fontWeight: 700 }}>
              in {daysUntil(nextEvent.date)} days
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.12fr 0.88fr", gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, overflowY: "auto", paddingRight: 2 }}>
          {events.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              No events scheduled yet.
            </div>
          )}
          {events.map((e) => {
            const isSelected = e.id === selected?.id;
            const isCompleted = e.date < now;
            const style = typeStyle(e.type);
            return (
              <Link
                key={e.id}
                href={`/app/events?event=${e.id}`}
                className="card"
                style={{ display: "flex", gap: 14, padding: "15px 16px", textDecoration: "none", color: "inherit", border: isSelected ? "1.5px solid var(--marigold)" : "1px solid var(--line)", boxShadow: isSelected ? "0 0 0 3px var(--marigold-tint)" : undefined }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 10, background: style.bg, color: style.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: "none", lineHeight: 1.1 }}>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>
                    {String(e.date.getDate()).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" }}>{e.date.toLocaleDateString("en-IN", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
                    {e.type && (
                      <span className="pill" style={{ background: style.bg, color: style.fg }}>
                        {e.type}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 5 }}>
                    {e.date.toLocaleDateString("en-IN", { weekday: "short" })} {e.venue && `· ${e.venue}`}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 9 }}>
                    <span style={{ fontSize: 11.5, color: "var(--faint)" }}>{e.expectedAttendance !== null ? `${e.expectedAttendance} expected` : ""}</span>
                    <span className="pill" style={{ background: isCompleted ? "var(--good-tint)" : "var(--marigold-tint)", color: isCompleted ? "var(--good)" : "var(--marigold-deep)" }}>
                      {isCompleted ? "Completed" : `Upcoming · ${daysUntil(e.date)}d`}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {selected ? (
          <EventDetail
            event={{
              id: selected.id,
              title: selected.title,
              type: selected.type,
              date: selected.date.toISOString(),
              venue: selected.venue,
              expectedAttendance: selected.expectedAttendance,
              budgetEstimate: selected.budgetEstimate ? Number(selected.budgetEstimate) : null,
              checklistItems: selected.checklistItems,
            }}
            canEdit={canEdit}
          />
        ) : (
          <div className="card" style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
            No event selected.
          </div>
        )}
      </div>
    </div>
  );
}

async function ParentEventsView() {
  const sdb = await getScopedDb();
  const events = await sdb.event.findMany({ orderBy: { date: "asc" } });
  const now = new Date();

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        School events
      </div>
      {events.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
          No events scheduled yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {events.map((e) => {
            const isCompleted = e.date < now;
            const style = typeStyle(e.type);
            return (
              <div key={e.id} className="card" style={{ display: "flex", gap: 14, padding: "15px 16px" }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: style.bg, color: style.fg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>
                    {String(e.date.getDate()).padStart(2, "0")}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" }}>{e.date.toLocaleDateString("en-IN", { month: "short" })}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>{e.venue}</div>
                  <span className="pill" style={{ marginTop: 8, display: "inline-block", background: isCompleted ? "var(--good-tint)" : "var(--marigold-tint)", color: isCompleted ? "var(--good)" : "var(--marigold-deep)" }}>
                    {isCompleted ? "Completed" : `Upcoming · ${daysUntil(e.date)}d`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
