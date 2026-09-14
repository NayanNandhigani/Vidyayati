"use client";

import { useState, useTransition } from "react";
import { updateBook, deleteBook } from "./actions";

type Book = { id: string; title: string; author: string | null; accessionNo: string; category: string | null; copiesTotal: number; copiesAvailable: number; isbn: string | null };

export default function EditBookPanel({ books, showIsbn }: { books: Book[]; showIsbn: boolean }) {
  const [selectedId, setSelectedId] = useState(books[0]?.id ?? "");
  const selected = books.find((b) => b.id === selectedId) ?? null;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState(selected?.title ?? "");
  const [author, setAuthor] = useState(selected?.author ?? "");
  const [accessionNo, setAccessionNo] = useState(selected?.accessionNo ?? "");
  const [category, setCategory] = useState(selected?.category ?? "");
  const [copies, setCopies] = useState(selected?.copiesTotal.toString() ?? "");
  const [isbn, setIsbn] = useState(selected?.isbn ?? "");

  function pick(id: string) {
    const b = books.find((bk) => bk.id === id);
    setSelectedId(id);
    setTitle(b?.title ?? "");
    setAuthor(b?.author ?? "");
    setAccessionNo(b?.accessionNo ?? "");
    setCategory(b?.category ?? "");
    setCopies(b?.copiesTotal.toString() ?? "");
    setIsbn(b?.isbn ?? "");
    setError(null);
    setSaved(false);
  }

  function save() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateBook(selected.id, { title, author: author || null, accessionNo, category: category || null, copiesTotal: Number(copies), isbn: isbn || null });
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function remove() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteBook(selected.id);
        const remaining = books.filter((b) => b.id !== selected.id);
        pick(remaining[0]?.id ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not delete.");
      }
    });
  }

  if (books.length === 0) {
    return <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--muted)", maxWidth: 520 }}>No titles in the catalogue yet — add one first.</div>;
  }

  return (
    <div className="card" style={{ padding: 24, maxWidth: 520, display: "flex", flexDirection: "column", gap: 16 }}>
      <label className="field">
        Select a title to edit
        <select className="in" value={selectedId} onChange={(e) => pick(e.target.value)}>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} ({b.accessionNo})
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <>
          <label className="field">
            Title
            <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            Author
            <input className="in" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label className="field">
              Accession no.
              <input className="in mono" value={accessionNo} onChange={(e) => setAccessionNo(e.target.value)} required />
            </label>
            <label className="field">
              Category
              <input className="in" value={category} onChange={(e) => setCategory(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: showIsbn ? "1fr 1fr" : "1fr", gap: 14 }}>
            <label className="field">
              Number of copies
              <input className="in mono" type="number" min={0} value={copies} onChange={(e) => setCopies(e.target.value)} required />
            </label>
            {showIsbn && (
              <label className="field">
                ISBN
                <input className="in mono" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
              </label>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {selected.copiesTotal - selected.copiesAvailable} of {selected.copiesTotal} currently on loan — reducing the copy count below that keeps availability at 0, not negative.
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
              {error}
            </p>
          )}
          {saved && !error && <div style={{ fontSize: 12.5, color: "var(--good)", fontWeight: 600 }}>Saved.</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={save} disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
              {pending ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={remove} disabled={pending} style={{ background: "var(--card)", border: "1px solid var(--critical)", color: "var(--critical)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer" }}>
              Delete title
            </button>
          </div>
        </>
      )}
    </div>
  );
}
