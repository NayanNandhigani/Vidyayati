import Link from "next/link";

const MODULES = [
  { name: "Students & Academics", desc: "Enrolment, classes, attendance, homework, timetables and exam report cards in one record per child." },
  { name: "Fees & Accounts", desc: "Track dues, record payments, and keep a simple cash-flow ledger — fee collections sync into Accounts automatically." },
  { name: "Admissions Pipeline", desc: "A Kanban board from first enquiry through to admitted, so nothing slips through the front office." },
  { name: "Staff & Payroll", desc: "Per-module access control instead of rigid roles — a class teacher gets exactly the permissions they need." },
  { name: "Transport & Hostel", desc: "Routes, stops, pickup times, and hostel room allocation, all tied back to the student record." },
  { name: "Communication", desc: "In-app announcements to parents and staff, targeted by class or by student, with read receipts." },
];

const STATS = [
  { value: "41", label: "data tables, one record per student" },
  { value: "3", label: "portal roles — Admin, Staff, Parent" },
  { value: "100%", label: "tenant-isolated by school" },
];

// This was the only remaining statically-prerendered route in the app —
// same failure mode as the /login redirect loop this replaces: a static
// page ships a year-long default cache lifetime, and any response
// captured while something was misconfigured can get stuck being served
// indefinitely, surviving redeploys since they only rebuild the container.
export const dynamic = "force-dynamic";

export default function MarketingHome() {
  console.log("[page-debug] rendering /");
  return (
    <div style={{ background: "#0a0e1a", color: "#e8ebf5", minHeight: "100dvh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 40px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10,14,26,0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--marigold)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              color: "#0a0e1a",
              fontSize: 15,
            }}
          >
            V
          </div>
          <span className="disp" style={{ fontSize: 17, color: "#fff" }}>
            Vidya Yati
          </span>
        </div>
        <nav style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13.5, color: "#aeb8d6" }}>
          <a href="#modules" style={{ color: "inherit", textDecoration: "none" }}>
            Modules
          </a>
          <a href="#why" style={{ color: "inherit", textDecoration: "none" }}>
            Why Vidya Yati
          </a>
          <a href="#pricing" style={{ color: "inherit", textDecoration: "none" }}>
            Pricing
          </a>
          <Link
            href="/signin"
            style={{ background: "var(--marigold)", color: "#0a0e1a", borderRadius: 8, padding: "8px 18px", fontWeight: 700, textDecoration: "none" }}
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section style={{ padding: "100px 40px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(224,138,44,0.18), transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <span
            className="mono"
            style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--marigold)", background: "rgba(224,138,44,0.12)", border: "1px solid rgba(224,138,44,0.3)", borderRadius: 100, padding: "5px 14px", marginBottom: 22 }}
          >
            Built for Indian schools &amp; kindergartens
          </span>
          <h1 className="disp" style={{ fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.08, color: "#fff", margin: "0 0 20px", maxWidth: 820, marginLeft: "auto", marginRight: "auto" }}>
            One system for admissions, academics, fees, and everything in between.
          </h1>
          <p style={{ fontSize: 17, color: "#aeb8d6", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.6 }}>
            Vidya Yati replaces the spreadsheets and paper registers with a single platform your admin office, teachers, and parents actually want to use.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signin" style={{ background: "var(--marigold)", color: "#0a0e1a", borderRadius: 10, padding: "13px 26px", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>
              Sign in to your school
            </Link>
            <a
              href="mailto:hello@vidyayati.in?subject=Vidya%20Yati%20demo%20request"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: 10, padding: "13px 26px", fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}
            >
              Talk to us →
            </a>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 40px 80px", display: "flex", justifyContent: "center", gap: 60, flexWrap: "wrap" }}>
        {STATS.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--marigold)" }}>
              {s.value}
            </div>
            <div style={{ fontSize: 13, color: "#7f8bb0", marginTop: 4, maxWidth: 160 }}>{s.label}</div>
          </div>
        ))}
      </section>

      <section id="modules" style={{ padding: "40px 40px 100px", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div className="mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--teal)", marginBottom: 10 }}>
            Everything, connected
          </div>
          <h2 className="disp" style={{ fontSize: 32, color: "#fff", margin: 0 }}>
            One record per student. No re-entering data twice.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {MODULES.map((m) => (
            <div key={m.name} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{m.name}</div>
              <div style={{ fontSize: 13.5, color: "#aeb8d6", lineHeight: 1.6 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="why" style={{ padding: "0 40px 100px", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(224,138,44,0.1), rgba(30,110,113,0.1))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "48px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div>
            <h2 className="disp" style={{ fontSize: 28, color: "#fff", margin: "0 0 14px" }}>
              Every school is a tenant of its own.
            </h2>
            <p style={{ fontSize: 14.5, color: "#aeb8d6", lineHeight: 1.7, margin: 0 }}>
              Your school's data — students, staff, fees, results — is isolated from every other school on the platform. One login system covers your Admin, Staff and Parent accounts, with staff permissions granted per module rather than a fixed role.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
            {["Real Postgres data, not a spreadsheet export", "Per-module staff permissions, not all-or-nothing roles", "In-app announcements with read receipts", "A cash-flow ledger that reconciles itself"].map((line) => (
              <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#e8ebf5" }}>
                <span style={{ color: "var(--marigold)", fontWeight: 700, flex: "none" }}>✓</span>
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ padding: "0 40px 110px", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div className="mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--clay)", marginBottom: 10 }}>
            Plans
          </div>
          <h2 className="disp" style={{ fontSize: 32, color: "#fff", margin: 0 }}>
            Priced for your school's size.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#7f8bb0", marginBottom: 8 }}>Standard</div>
            <div style={{ fontSize: 15, color: "#aeb8d6", marginBottom: 22, lineHeight: 1.6 }}>Every core module — academics, fees, admissions, communication.</div>
            <a href="mailto:hello@vidyayati.in?subject=Standard%20plan%20enquiry" style={{ display: "block", textAlign: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "11px 0", color: "#fff", fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>
              Contact sales
            </a>
          </div>
          <div style={{ background: "linear-gradient(160deg, rgba(224,138,44,0.15), rgba(224,138,44,0.03))", border: "1px solid rgba(224,138,44,0.4)", borderRadius: 16, padding: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--marigold)", marginBottom: 8 }}>Premium</div>
            <div style={{ fontSize: 15, color: "#e8ebf5", marginBottom: 22, lineHeight: 1.6 }}>Everything in Standard, plus transport, hostel, and library management.</div>
            <a href="mailto:hello@vidyayati.in?subject=Premium%20plan%20enquiry" style={{ display: "block", textAlign: "center", background: "var(--marigold)", borderRadius: 8, padding: "11px 0", color: "#0a0e1a", fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
              Contact sales
            </a>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "28px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 12.5, color: "#7f8bb0" }}>© {new Date().getFullYear()} Vidya Yati. All rights reserved.</span>
        <div style={{ display: "flex", gap: 20, fontSize: 12.5 }}>
          <a href="mailto:hello@vidyayati.in" style={{ color: "#aeb8d6", textDecoration: "none" }}>
            hello@vidyayati.in
          </a>
          <Link href="/signin" style={{ color: "#aeb8d6", textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
