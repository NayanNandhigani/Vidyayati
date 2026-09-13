"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getScopedDb, scopedCreateData } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";

export type FormState = { error?: string };

export async function createBook(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireModuleAccess("Library", "EDIT");
  const sdb = await getScopedDb();

  const title = formData.get("title");
  const author = formData.get("author");
  const accessionNo = formData.get("accessionNo");
  const category = formData.get("category");
  const copies = formData.get("copies");
  const isbn = formData.get("isbn");

  if (typeof title !== "string" || !title.trim() || typeof accessionNo !== "string" || !accessionNo.trim() || typeof copies !== "string" || !copies) {
    return { error: "Title, accession number, and copy count are required." };
  }

  await sdb.libraryBook.create({
    data: scopedCreateData<Prisma.LibraryBookUncheckedCreateInput>({
      title: title.trim(),
      author: typeof author === "string" && author ? author : null,
      accessionNo: accessionNo.trim(),
      category: typeof category === "string" && category ? category : null,
      copiesTotal: Number(copies),
      copiesAvailable: Number(copies),
      isbn: typeof isbn === "string" && isbn.trim() ? isbn.trim() : null,
    }),
  });

  revalidatePath("/app/library");
  redirect("/app/library");
}

export type UpdateBookFields = { title: string; author: string | null; accessionNo: string; category: string | null; copiesTotal: number; isbn: string | null };

export async function updateBook(bookId: string, fields: UpdateBookFields) {
  await requireModuleAccess("Library", "EDIT");
  if (!fields.title.trim() || !fields.accessionNo.trim() || !(fields.copiesTotal >= 0)) {
    throw new Error("Title, accession number, and a valid copy count are required.");
  }
  const sdb = await getScopedDb();
  const book = await sdb.libraryBook.findUniqueOrThrow({ where: { id: bookId } });

  // Copies currently checked out never change on an edit — only the total
  // (and therefore how many of the new total remain available) does.
  const issuedCount = book.copiesTotal - book.copiesAvailable;
  const newAvailable = Math.max(0, fields.copiesTotal - issuedCount);

  await sdb.libraryBook.update({
    where: { id: bookId },
    data: {
      title: fields.title.trim(),
      author: fields.author?.trim() || null,
      accessionNo: fields.accessionNo.trim(),
      category: fields.category?.trim() || null,
      copiesTotal: fields.copiesTotal,
      copiesAvailable: newAvailable,
      isbn: fields.isbn?.trim() || null,
    },
  });

  revalidatePath("/app/library");
}

export async function deleteBook(bookId: string) {
  await requireModuleAccess("Library", "EDIT");
  const sdb = await getScopedDb();
  const activeLoans = await sdb.libraryCirculation.count({ where: { bookId, status: "ISSUED" } });
  if (activeLoans > 0) throw new Error("This title has copies currently on loan — return them before deleting it.");
  await sdb.libraryBook.delete({ where: { id: bookId } });
  revalidatePath("/app/library");
}

export async function issueBook(studentId: string, bookId: string) {
  await requireModuleAccess("Library", "EDIT");
  const sdb = await getScopedDb();

  const book = await sdb.libraryBook.findUniqueOrThrow({ where: { id: bookId } });
  await sdb.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true } });
  if (book.copiesAvailable <= 0) throw new Error("No copies available.");

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);

  await sdb.$transaction([
    sdb.libraryCirculation.create({
      data: scopedCreateData<Prisma.LibraryCirculationUncheckedCreateInput>({ bookId, studentId, issueDate, dueDate, status: "ISSUED" }),
    }),
    sdb.libraryBook.update({ where: { id: bookId }, data: { copiesAvailable: { decrement: 1 } } }),
  ]);

  revalidatePath("/app/library");
}

export async function returnBook(circulationId: string) {
  await requireModuleAccess("Library", "EDIT");
  const sdb = await getScopedDb();

  const circ = await sdb.libraryCirculation.findUniqueOrThrow({ where: { id: circulationId } });

  await sdb.$transaction([
    sdb.libraryCirculation.update({ where: { id: circulationId }, data: { status: "RETURNED", returnDate: new Date() } }),
    sdb.libraryBook.update({ where: { id: circ.bookId }, data: { copiesAvailable: { increment: 1 } } }),
  ]);

  revalidatePath("/app/library");
}
