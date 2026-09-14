"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { requireFeature } from "@/lib/feature-flags";
import { studentName } from "@/lib/format";
import { computeLibraryFine } from "@/lib/library";
import { issueBook } from "./actions";

async function schoolId() {
  const session = await auth();
  return session!.user.schoolId!;
}

/**
 * Scan-style issue: a barcode scanner types the accession number followed by
 * Enter, same as manual keyboard entry. Resolves it to a book id and defers
 * to the existing, untouched `issueBook` action for the actual transaction.
 */
export async function issueBookByAccession(studentId: string, accessionNo: string) {
  await requireModuleAccess("Library", "EDIT");
  await requireFeature(await schoolId(), "library.barcodesAndFines");
  const sdb = await getScopedDb();

  const book = await sdb.libraryBook.findFirst({ where: { accessionNo: accessionNo.trim() } });
  if (!book) throw new Error(`No book found with accession no. "${accessionNo.trim()}".`);

  await issueBook(studentId, book.id);
}

/**
 * Depth version of `returnBook` — computes an overdue fine from the
 * school's configured rate/grace-days and, when non-zero, posts it as an
 * AccountsTransaction (source AUTO_LIBRARY_FINE), same auto-posting pattern
 * as AUTO_FEES/AUTO_PAYROLL. The plain `returnBook` in actions.ts is
 * completely untouched — a school without this feature keeps today's exact
 * behavior (no fine ever computed or charged).
 */
export async function returnBookWithFine(circulationId: string) {
  await requireModuleAccess("Library", "EDIT");
  const sid = await schoolId();
  await requireFeature(sid, "library.barcodesAndFines");
  const sdb = await getScopedDb();

  const circ = await sdb.libraryCirculation.findUniqueOrThrow({ where: { id: circulationId }, include: { book: true, student: true } });
  const school = await sdb.school.findUniqueOrThrow({ where: { id: sid }, select: { libraryFineRatePerDay: true, libraryFineGraceDays: true } });

  const returnDate = new Date();
  const fine = computeLibraryFine(circ.dueDate, returnDate, school.libraryFineRatePerDay ? Number(school.libraryFineRatePerDay) : null, school.libraryFineGraceDays);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    sdb.libraryCirculation.update({ where: { id: circulationId }, data: { status: "RETURNED", returnDate, fineAmount: fine > 0 ? fine : null } }),
    sdb.libraryBook.update({ where: { id: circ.bookId }, data: { copiesAvailable: { increment: 1 } } }),
  ];
  if (fine > 0) {
    ops.push(
      sdb.accountsTransaction.create({
        data: scopedCreateData<Prisma.AccountsTransactionUncheckedCreateInput>({
          date: returnDate,
          description: `Library fine — ${circ.book.title} (${studentName(circ.student)})`,
          category: "Library fine",
          source: "AUTO_LIBRARY_FINE",
          type: "INCOME",
          amount: fine,
        }),
      })
    );
  }
  await sdb.$transaction(ops);

  revalidatePath("/app/library");
  revalidatePath("/app/accounts");
  return { fine };
}

/** Scan-style return: resolve the accession no. to its single active loan, then return it (with fine calc). */
export async function returnBookByAccession(accessionNo: string) {
  await requireModuleAccess("Library", "EDIT");
  await requireFeature(await schoolId(), "library.barcodesAndFines");
  const sdb = await getScopedDb();

  const book = await sdb.libraryBook.findFirst({ where: { accessionNo: accessionNo.trim() } });
  if (!book) throw new Error(`No book found with accession no. "${accessionNo.trim()}".`);

  const circs = await sdb.libraryCirculation.findMany({ where: { bookId: book.id, status: "ISSUED" } });
  if (circs.length === 0) throw new Error(`"${book.title}" has no active loan to return.`);
  if (circs.length > 1) throw new Error(`"${book.title}" has multiple active loans — return manually from the list below.`);

  return returnBookWithFine(circs[0].id);
}

/** Looks up a book's title/author from its ISBN via the free Open Library API. Never throws for a "not found" or network failure — always falls back to manual entry. */
export async function lookupIsbn(isbn: string): Promise<{ title?: string; author?: string; error?: string }> {
  await requireModuleAccess("Library", "EDIT");
  await requireFeature(await schoolId(), "library.isbnLookup");

  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (!clean) return { error: "Enter a valid ISBN first." };

  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { error: "Lookup service unavailable — enter details manually." };
    const data = await res.json();
    const entry = data[`ISBN:${clean}`];
    if (!entry) return { error: "No match found for that ISBN — enter details manually." };
    return { title: entry.title, author: entry.authors?.[0]?.name };
  } catch {
    return { error: "Couldn't reach the lookup service — enter details manually." };
  }
}

export async function updateLibraryFineSettings(ratePerDay: number | null, graceDays: number | null) {
  await requireModuleAccess("Library", "EDIT");
  const sid = await schoolId();
  await requireFeature(sid, "library.barcodesAndFines");
  const sdb = await getScopedDb();
  await sdb.school.update({ where: { id: sid }, data: { libraryFineRatePerDay: ratePerDay, libraryFineGraceDays: graceDays } });
  revalidatePath("/app/library");
}
