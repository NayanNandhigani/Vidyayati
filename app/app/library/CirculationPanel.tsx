"use client";

import { useState, useTransition } from "react";
import { studentName } from "@/lib/format";
import { computeLibraryFine } from "@/lib/library";
import { issueBook, returnBook } from "./actions";

type Circ = { id: string; studentName: string; bookTitle: string; issueDate: string; dueDate: string; overdueDays: number };

export default function CirculationPanel({
  students,
  books,
  issued,
  returnFn,
  fineRatePerDay,
  fineGraceDays,
  scanPanel,
}: {
  students: { id: string; firstName: string; surname: string }[];
  books: { id: string; title: string; copiesAvailable: number }[];
  issued: Circ[];
  /** Depth override: when the library.barcodesAndFines feature is on, the page passes returnBookWithFine instead. Defaults to the plain, untouched returnBook. */
  returnFn?: (circulationId: string) => Promise<unknown>;
  /** When set, a live fine preview is shown next to each overdue loan. */
  fineRatePerDay?: number | null;
  fineGraceDays?: number | null;
  /** Optional extra content (the scan-mode inputs) rendered below the issue form — additive, absent for schools without the feature. */
  scanPanel?: React.ReactNode;
}) {
  const [studentId, setStudentId] = useState("");
  const [bookId, setBookId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const doReturnAction = returnFn ?? returnBook;

  function submit() {
    if (!studentId || !bookId) return;
    setError(null);
    startTransition(async () => {
      try {
        await issueBook(studentId, bookId);
        setStudentId("");
        setBookId("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not issue.");
      }
    });
  }

  function doReturn(id: string) {
    startTransition(async () => {
      await doReturnAction(id);
    });
  }

  const overdueCount = issued.filter((c) => c.overdueDays > 0).length;

  return (
    <div className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Issue a book</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select className="in" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {studentName(s)}
              </option>
            ))}
          </select>
          <select className="in" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">Select book…</option>
            {books.map((b) => (
              <option key={b.id} value={b.id} disabled={b.copiesAvailable <= 0}>
                {b.title} ({b.copiesAvailable} available)
              </option>
            ))}
          </select>
        </div>
        {error && <div style={{ color: "var(--critical)", fontSize: 12, marginTop: 6 }}>{error}</div>}
        <span onClick={submit} style={{ display: "block", background: "var(--marigold)", color: "#fff", borderRadius: 8, padding: 9, textAlign: "center", fontSize: 13, fontWeight: 700, marginTop: 10, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Issuing…" : "Issue Book"}
        </span>
        {scanPanel}
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Currently issued</div>
          {overdueCount > 0 && (
            <span className="pill" style={{ background: "var(--critical-tint)", color: "var(--critical)" }}>
              {overdueCount} overdue
            </span>
          )}
        </div>
        {issued.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>Nothing currently issued.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {issued.map((c) => {
            const finePreview = fineRatePerDay ? computeLibraryFine(c.dueDate, new Date(), fineRatePerDay, fineGraceDays) : 0;
            return (
              <div key={c.id} style={{ border: `1px solid ${c.overdueDays > 0 ? "var(--critical)" : "var(--line)"}`, background: c.overdueDays > 0 ? "var(--critical-tint)" : "transparent", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{c.studentName}</div>
                  <span className="pill" style={{ background: c.overdueDays > 0 ? "#fff" : "var(--good-tint)", color: c.overdueDays > 0 ? "var(--critical)" : "var(--good)" }}>
                    {c.overdueDays > 0 ? `Overdue · ${c.overdueDays}d` : "On time"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--ink2)", margin: "2px 0 4px" }}>{c.bookTitle}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
                    Issued {new Date(c.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · Due {new Date(c.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {finePreview > 0 && <> · Fine ₹{finePreview}</>}
                  </span>
                  <span onClick={() => doReturn(c.id)} style={{ fontSize: 11, fontWeight: 700, color: "var(--marigold-deep)", cursor: "pointer" }}>
                    Return
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
