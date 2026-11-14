"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sendMagicLink, sendPasswordReset } from "@/server/auth";
import { SLUG_RE } from "@/server/orders";
import { allow, TOO_MANY } from "@/server/rate-limit";

export type EmailState = { error?: string; sent?: boolean };

const Email = z.email("Format email belum benar.").trim().toLowerCase();

export async function goToOffice(form: FormData) {
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  redirect(SLUG_RE.test(slug) ? `/o/${slug}/masuk` : "/masuk");
}

/** Respons selalu "terkirim" walau email tidak terdaftar, supaya daftar pelanggan tidak bisa ditebak. */
export async function magicLinkAction(_: EmailState, form: FormData): Promise<EmailState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  if (!(await allow("magic-link", 3, 600, email.data))) return { error: TOO_MANY };
  await sendMagicLink(email.data).catch(() => {});
  return { sent: true };
}

export async function resetAction(_: EmailState, form: FormData): Promise<EmailState> {
  const email = Email.safeParse(form.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  if (!(await allow("reset", 3, 600, email.data))) return { error: TOO_MANY };
  await sendPasswordReset(email.data).catch(() => {});
  return { sent: true };
}
