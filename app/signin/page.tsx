import LoginForm from "./LoginForm";

// Never statically prerender/cache this page. A cached login response
// (Next's default s-maxage=31536000 for static pages) can get stuck at
// an edge/proxy layer for up to a year — including a response captured
// during an outage (e.g. a transient auth misconfiguration) — and a
// redeploy only refreshes the container's own build, not that cache.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  console.log("[page-debug] rendering /signin");
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
        <h1 className="disp" style={{ fontSize: 24, margin: "0 0 4px" }}>
          Vidya Yati
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--muted)" }}>
          Sign in — school Admin, Staff, and Parent accounts, and Vidya Yati platform admins, all use this page.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
