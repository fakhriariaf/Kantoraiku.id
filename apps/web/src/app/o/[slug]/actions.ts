"use server";

import { redirect } from "next/navigation";
import { getOfficeForUser, getUser, signInWithPassword, signOut } from "@/server/auth";
import { allow, TOO_MANY } from "@/server/rate-limit";

export async function officeLogin(slug: string, _: { error?: string }, form: FormData): Promise<{ error?: string }> {
  if (!(await allow("office-login", 10, 600, slug))) return { error: TOO_MANY };
  const ok = await signInWithPassword(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return { error: "Email atau password salah." };
  const u = await getUser();
  if (!u || !(await getOfficeForUser(slug, u.id))) {
    await signOut();
    return { error: "Akun ini tidak terdaftar di kantor ini." };
  }
  redirect(`/o/${slug}`);
}

export async function officeLogout(slug: string) {
  await signOut();
  redirect(`/o/${slug}/masuk`);
}
