import { auth } from "@/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { changePassword } from "@/app/super-admin/settings/actions";

export default async function SuperAdminChangePasswordPage() {
  const session = await auth();

  return (
    <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 18, height: "100dvh", boxSizing: "border-box", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ padding: 28, width: "100%", maxWidth: 440 }}>
        <div className="disp" style={{ fontSize: 20, marginBottom: 4 }}>
          Change password
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>Signed in as {session?.user.name}</div>
        <ChangePasswordForm action={changePassword} redirectTo="/super-admin/dashboard" forced={session?.user.mustChangePassword} />
      </div>
    </div>
  );
}
