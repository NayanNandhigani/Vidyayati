import Link from "next/link";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { hasFeature } from "@/lib/feature-flags";
import { daysUntil, studentName } from "@/lib/format";
import CirculationPanel from "./CirculationPanel";
import { LibraryFineSettings, ScanCirculation } from "./LibraryDepthPanel";
import { returnBookWithFine } from "./depth-actions";
import NewBookForm from "./new/NewBookForm";
import EditBookPanel from "./EditBookPanel";

const TABS = ["catalogue", "add", "edit"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { catalogue: "Catalogue & Circulation", add: "Add Book", edit: "Edit Book" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentLibraryView />;
  }

  const accessLevel = await requireModuleAccess("Library", "VIEW");
  const canEdit = accessLevel === "EDIT";
  const params = await searchParams;
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "catalogue";

  const [books, students, issuedCirc, showBarcodes, showIsbnLookup, school] = await Promise.all([
    sdb.libraryBook.findMany({ orderBy: { title: "asc" } }),
    sdb.student.findMany({ where: { status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { surname: "asc" }], select: { id: true, firstName: true, surname: true } }),
    sdb.libraryCirculation.findMany({ where: { status: "ISSUED" }, include: { student: true, book: true }, orderBy: { dueDate: "asc" } }),
    hasFeature(session!.user.schoolId, "library.barcodesAndFines"),
    hasFeature(session!.user.schoolId, "library.isbnLookup"),
    sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { libraryFineRatePerDay: true, libraryFineGraceDays: true } }),
  ]);

  const totalCopies = books.reduce((s, b) => s + b.copiesTotal, 0);
  const overdueCount = issuedCirc.filter((c) => c.dueDate < new Date()).length;

  const holdersByBook = new Map<string, { name: string; overdue: boolean }[]>();
  for (const c of issuedCirc) {
    const list = holdersByBook.get(c.bookId) ?? [];
    list.push({ name: studentName(c.student), overdue: c.dueDate < new Date() });
    holdersByBook.set(c.bookId, list);
  }

  const issued = issuedCirc.map((c) => ({
    id: c.id,
    studentName: studentName(c.student),
    bookTitle: c.book.title,
    issueDate: c.issueDate.toISOString(),
    dueDate: c.dueDate.toISOString(),
    overdueDays: Math.max(0, -daysUntil(c.dueDate)),
  }));

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Library
        </div>
        {canEdit && showBarcodes && (
          <LibraryFineSettings ratePerDay={school?.libraryFineRatePerDay ? Number(school.libraryFineRatePerDay) : null} graceDays={school?.libraryFineGraceDays ?? null} />
        )}
      </div>

      {canEdit && (
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)" }}>
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/app/library?tab=${t}`}
              style={{ padding: "10px 2px", marginRight: 26, fontSize: 13.5, fontWeight: tab === t ? 700 : 600, color: tab === t ? "var(--ink)" : "var(--muted)", borderBottom: tab === t ? "2px solid var(--marigold)" : "2px solid transparent", textDecoration: "none" }}
            >
              {TAB_LABEL[t]}
            </Link>
          ))}
        </div>
      )}

      {tab === "add" ? (
        <div className="card" style={{ padding: 24, maxWidth: 480 }}>
          <NewBookForm showIsbnLookup={showIsbnLookup} />
        </div>
      ) : tab === "edit" ? (
        <EditBookPanel books={books.map((b) => ({ id: b.id, title: b.title, author: b.author, accessionNo: b.accessionNo, category: b.category, copiesTotal: b.copiesTotal, copiesAvailable: b.copiesAvailable, isbn: b.isbn }))} showIsbn={showIsbnLookup} />
      ) : (
        <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Titles in catalogue" value={books.length} />
        <Stat label="Total copies" value={totalCopies} />
        <Stat label="Currently issued" value={issuedCirc.length} color="var(--teal)" />
        <Stat label="Overdue" value={overdueCount} color="var(--critical)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: showBarcodes ? "1.8fr 1.3fr 1fr 0.9fr 1fr 1fr 0.7fr" : "2fr 1.4fr 1.1fr 1fr 1fr 1fr", padding: "13px 20px", borderBottom: "1px solid var(--line)", fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <div>Title</div>
            <div>Author</div>
            <div>Accession no.</div>
            <div>Category</div>
            <div>Copies (total/avail.)</div>
            <div>Status</div>
            {showBarcodes && <div>Barcode</div>}
          </div>
          <div style={{ overflowY: "auto" }}>
            {books.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No titles in the catalogue yet.</div>}
            {books.map((b) => {
              const allIssued = b.copiesAvailable === 0;
              const holders = holdersByBook.get(b.id) ?? [];
              return (
                <div key={b.id} style={{ display: "grid", gridTemplateColumns: showBarcodes ? "1.8fr 1.3fr 1fr 0.9fr 1fr 1fr 0.7fr" : "2fr 1.4fr 1.1fr 1fr 1fr 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.title}</div>
                    {showBarcodes && b.isbn && <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>ISBN {b.isbn}</div>}
                  </div>
                  <div style={{ color: "var(--muted)" }}>{b.author ?? "—"}</div>
                  <div className="mono" style={{ color: "var(--muted)" }}>{b.accessionNo}</div>
                  <div style={{ color: "var(--muted)" }}>{b.category ?? "—"}</div>
                  <div className="mono" style={{ color: allIssued ? "var(--warn)" : undefined }}>
                    {b.copiesTotal} / {b.copiesAvailable}
                  </div>
                  <div>
                    <span className="pill" style={{ background: allIssued ? "var(--warn-tint)" : "var(--good-tint)", color: allIssued ? "var(--warn)" : "var(--good)" }}>
                      {allIssued ? "All issued" : "Available"}
                    </span>
                    {holders.length > 0 && (
                      <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 3, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={holders.map((h) => h.name).join(", ")}>
                        Held by{" "}
                        {holders.map((h, i) => (
                          <span key={i} style={{ color: h.overdue ? "var(--critical)" : "var(--faint)", fontWeight: h.overdue ? 700 : 400 }}>
                            {h.name}
                            {i < holders.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {showBarcodes && (
                    <a href={`/api/qrcode?data=${encodeURIComponent(b.accessionNo)}`} target="_blank" rel="noreferrer" title="Open full-size for printing">
                      <img src={`/api/qrcode?data=${encodeURIComponent(b.accessionNo)}`} alt="Barcode" width={34} height={34} style={{ borderRadius: 4, border: "1px solid var(--line)" }} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <CirculationPanel
          students={students}
          books={books.map((b) => ({ id: b.id, title: b.title, copiesAvailable: b.copiesAvailable }))}
          issued={issued}
          returnFn={showBarcodes ? returnBookWithFine : undefined}
          fineRatePerDay={showBarcodes && school?.libraryFineRatePerDay ? Number(school.libraryFineRatePerDay) : null}
          fineGraceDays={showBarcodes ? (school?.libraryFineGraceDays ?? null) : null}
          scanPanel={showBarcodes ? <ScanCirculation key="scan-circulation" students={students.map((s) => ({ id: s.id, name: studentName(s) }))} /> : null}
        />
      </div>
        </>
      )}
    </div>
  );
}

async function ParentLibraryView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: { studentLinks: { include: { student: { include: { libraryCirculations: { include: { book: true }, orderBy: { issueDate: "desc" } } } } } } },
  });
  const students = parent?.studentLinks.map((l) => l.student) ?? [];

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Library
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {students.map((s) => (
        <div key={s.id} className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>{studentName(s)}</div>
          {s.libraryCirculations.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No books issued yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.libraryCirculations.map((c) => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.book.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--faint)" }}>
                      Issued {c.issueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · Due {c.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                  <span className="pill" style={{ background: c.status === "ISSUED" ? "var(--warn-tint)" : "var(--good-tint)", color: c.status === "ISSUED" ? "var(--warn)" : "var(--good)" }}>
                    {c.status === "ISSUED" ? "Issued" : "Returned"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
