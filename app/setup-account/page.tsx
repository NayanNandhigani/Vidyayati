import { db } from "@/lib/db";
import { hashSetupToken } from "@/lib/account-setup";
import SetupAccountForm from "./SetupAccountForm";

export default async function SetupAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  const user = token
    ? await db.user.findUnique({ where: { setupTokenHash: hashSetupToken(token) }, select: { name: true, username: true, setupTokenExpiresAt: true } })
    : null;
  const expired = user ? !user.setupTokenExpiresAt || user.setupTokenExpiresAt < new Date() : false;
  const valid = !!token && !!user && !expired;

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
          Set up your account
        </h1>
        {valid ? (
          <>
            <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--muted)" }}>
              Welcome, {user!.name} — choose a password for <b className="mono">{user!.username}</b> to finish setting up your Vidya Yati account.
            </p>
            <SetupAccountForm token={token!} />
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {!token
              ? "This link is missing its setup token."
              : "This setup link is invalid, expired, or has already been used. Ask whoever created your account to generate a new one."}
          </p>
        )}
      </div>
    </main>
  );
}
