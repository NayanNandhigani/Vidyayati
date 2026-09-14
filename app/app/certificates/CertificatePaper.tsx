function assetUrl(path: string) {
  return `/api/certificate-assets/${path}`;
}

// Always A4 proportions (210mm : 297mm = 1 : 1.4142), regardless of the
// width it's laid out at — matches the PDF export (lib/certificate-pdf.tsx
// already uses <Page size="A4">), so what's previewed here is genuinely
// the same shape as what gets downloaded/printed.
export default function CertificatePaper({
  schoolName,
  title,
  body,
  issuedDate,
  logoPath,
}: {
  schoolName: string;
  title: string;
  body: string;
  issuedDate: Date;
  logoPath?: string | null;
}) {
  return (
    <div style={{ border: "1px solid var(--marigold-tint)", borderRadius: 12, padding: 4, width: "100%", maxWidth: 520, margin: "0 auto" }}>
      <div style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "28px 32px", background: "#FFFEFB", aspectRatio: "210 / 297", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(logoPath)} alt="" style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 6 }} />
            )}
            <div className="disp" style={{ fontSize: 17 }}>
              {schoolName}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9.5, color: "var(--muted)" }}>
            <div className="mono">Date: {issuedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
        </div>
        <div style={{ height: 2, background: "linear-gradient(90deg,var(--marigold),var(--marigold-tint))", margin: "15px 0 16px" }} />
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div className="disp" style={{ fontSize: 15, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {title}
          </div>
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.8, color: "var(--ink2)", textAlign: "justify", whiteSpace: "pre-line" }}>{body}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", border: "1.5px dashed var(--marigold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6.5, color: "var(--marigold-deep)", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>
            OFFICIAL
            <br />
            SEAL
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 140, borderTop: "1px solid var(--ink)", paddingTop: 5, fontSize: 11, fontWeight: 700 }}>Principal</div>
            <div style={{ fontSize: 9.5, color: "var(--muted)" }}>{schoolName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
