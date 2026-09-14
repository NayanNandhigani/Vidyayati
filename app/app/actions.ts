"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/signin");
}
