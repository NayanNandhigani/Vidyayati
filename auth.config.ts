import type { NextAuthConfig } from "next-auth";

// Split out from auth.ts so middleware (which always runs on the Edge
// runtime, even under `next start`) never pulls in bcrypt or the Prisma
// client — both use Node APIs Edge doesn't support. This config has no
// providers; auth.ts adds the Credentials provider for use in route
// handlers and server components, which run in the Node.js runtime.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId ?? null;
        token.username = user.username;
        token.mustChangePassword = user.mustChangePassword;
      }
      // Triggered by auth.ts's `unstable_update()`, called right after a
      // successful password change — without this, the JWT would keep
      // claiming mustChangePassword: true until the user's next full
      // sign-in, and middleware would bounce them right back to the
      // change-password page they just came from.
      if (trigger === "update" && session?.user && typeof session.user.mustChangePassword === "boolean") {
        token.mustChangePassword = session.user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as typeof session.user.role;
        session.user.schoolId = (token.schoolId as string | null) ?? null;
        session.user.username = token.username as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
};
