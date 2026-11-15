"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, signOut, updatePassword, verifyPassword } from "@/server/auth";
import { db } from "@/server/db";
import { allow, TOO_MANY } from "@/server/rate-limit";

export type FormState = { error?: string; ok?: number };

export async function renameOffice(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const { office } = await requireMember(slug);
  if (office.role !== "owner") return { error: "Hanya pemilik kantor yang bisa mengganti nama kantor." };
  const name = String(form.get("nama") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Nama kantor wajib diisi." };
  if (name.length > 80) return { error: "Nama kantor maksimal 80 karakter." };
  await (await db()).query(`update public.offices set display_name = $2, updated_at = now() where id = $1`, [office.id, name]);
  revalidatePath(`/o/${slug}`, "layout");
  return { ok: Date.now() };
}

export type PasswordState = FormState & { field?: "lama" | "baru" | "ulang" };

export async function changePassword(slug: string, _: PasswordState, form: FormData): Promise<PasswordState> {
  const { user } = await requireMember(slug);
  const old = String(form.get("lama") ?? "");
  const next = String(form.get("baru") ?? "");
  const again = String(form.get("ulang") ?? "");
  if (!old) return { error: "Isi password lama.", field: "lama" };
  if (next.length < 8) return { error: "Password baru minimal 8 karakter.", field: "baru" };
  if (next.length > 72) return { error: "Password baru maksimal 72 karakter.", field: "baru" };
  if (next !== again) return { error: "Ulangan password baru tidak sama.", field: "ulang" };
  if (next === old) return { error: "Password baru harus berbeda dari password lama.", field: "baru" };
  if (!(await allow("change-password", 5, 900, user.id))) return { error: TOO_MANY };
  if (!(await verifyPassword(user.email, old))) return { error: "Password lama salah.", field: "lama" };
  await updatePassword(user.id, next);
  return { ok: Date.now() };
}

/** Keluar dari semua browser dan HP yang sedang masuk ke akun ini, termasuk yang ini. */
export async function logoutEverywhere(slug: string) {
  await requireMember(slug);
  await signOut("global");
  redirect(`/o/${slug}/masuk`);
}
