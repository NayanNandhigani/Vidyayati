import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await db.user.findUnique({
          where: { username: username.trim().toLowerCase() },
          include: { school: { select: { loginBlocked: true } } },
        });
        if (!user || user.status !== "ACTIVE" || user.school?.loginBlocked) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        await db.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => {});
        await db.activityLog
          .create({ data: { userId: user.id, schoolId: user.schoolId, type: "LOGIN" } })
          .catch(() => {});

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
