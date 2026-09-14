"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return { error: "Enter your username and password." };
  }

  try {
    await signIn("credentials", { username, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      // Only a real "authorize() returned null" means bad credentials.
      // Anything else (DB unreachable, missing AUTH_SECRET, etc.) is a
      // server misconfiguration — log the real cause instead of masking
      // it as "wrong password", which makes that class of bug undebuggable.
      if (error.type === "CredentialsSignin") {
        return { error: "Incorrect username or password." };
      }
      console.error("Sign-in failed with a non-credentials auth error:", error);
      return { error: "Sign-in is temporarily unavailable. Please try again shortly." };
    }
    throw error;
  }

  const session = await auth();
  const destination = session?.user.role === "SUPER_ADMIN" ? "/super-admin/dashboard" : "/app/dashboard";
  redirect(destination);
}
