"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print-hide"
      style={{ background: "var(--marigold)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
    >
      Print / Save as PDF
    </button>
  );
}
