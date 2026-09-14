"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { createBook, type FormState } from "../actions";
import { lookupIsbn } from "../depth-actions";

const initialState: FormState = {};

export default function NewBookForm({ showIsbnLookup }: { showIsbnLookup: boolean }) {
  const [state, formAction, pending] = useActionState(createBook, initialState);
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [lookupPending, startLookup] = useTransition();
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);

  function doLookup() {
    if (!isbn.trim()) return;
    setLookupMsg(null);
    startLookup(async () => {
      const res = await lookupIsbn(isbn);
      if (res.error) {
        setLookupMsg(res.error);
      } else {
        if (res.title) setTitle(res.title);
        if (res.author) setAuthor(res.author);
        setLookupMsg("Filled from Open Library.");
      }
    });
  }

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 440 }}>
      {showIsbnLookup && (
        <label className="field">
          ISBN <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional — auto-fills title/author)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="in mono" name="isbn" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="9780143031579" style={{ flex: 1 }} />
            <button type="button" onClick={doLookup} disabled={lookupPending} style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "0 14px", fontSize: 12.5, fontWeight: 600, cursor: lookupPending ? "default" : "pointer" }}>
              {lookupPending ? "Looking up…" : "Look up"}
            </button>
          </div>
          {lookupMsg && <span style={{ fontSize: 11.5, color: lookupMsg.includes("Filled") ? "var(--good)" : "var(--warn)", fontWeight: 500 }}>{lookupMsg}</span>}
        </label>
      )}
      <label className="field">
        Title
        <input className="in" name="title" required placeholder="Wings of Fire" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        Author
        <input className="in" name="author" placeholder="A.P.J. Abdul Kalam" value={author} onChange={(e) => setAuthor(e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="field">
          Accession no.
          <input className="in mono" name="accessionNo" required placeholder="ACC-01123" />
        </label>
        <label className="field">
          Category
          <input className="in" name="category" placeholder="Biography" />
        </label>
      </div>
      <label className="field">
        Number of copies
        <input className="in mono" type="number" name="copies" required min={1} placeholder="4" />
      </label>
      {state.error && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--critical)", background: "var(--critical-tint)", border: "1px solid var(--critical-border)", borderRadius: 8, padding: "8px 11px" }}>
          {state.error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending} style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Saving…" : "Add title"}
        </button>
        <Link href="/app/library" style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", color: "var(--ink)" }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
