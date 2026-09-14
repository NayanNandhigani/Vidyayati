// Fails fast at boot rather than silently running an insecure production
// deployment — the single most likely deploy mistake for this app is
// copying `.env`'s local dev values (a placeholder AUTH_SECRET, or a
// DATABASE_URL still pointing at localhost) straight into a real host.
// Imported once, for its side effect, from instrumentation.ts (see
// Next.js's instrumentation hook), so it runs on every server start
// before any request is handled.
const DEV_PLACEHOLDER_SECRET = "dev-placeholder-secret-change-me-nP9kX2vL7qR4tY8w";

export function checkProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const problems: string[] = [];

  if (!process.env.AUTH_SECRET) {
    problems.push("AUTH_SECRET is not set.");
  } else if (process.env.AUTH_SECRET === DEV_PLACEHOLDER_SECRET) {
    problems.push("AUTH_SECRET is still the local dev placeholder — generate a real one with `openssl rand -base64 32`.");
  }

  if (!process.env.DATABASE_URL) {
    problems.push("DATABASE_URL is not set.");
  } else if (/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
    problems.push("DATABASE_URL points at localhost — that's the local dev database, not a reachable production database.");
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to start in production with an insecure configuration:\n- ${problems.join("\n- ")}`);
  }
}
