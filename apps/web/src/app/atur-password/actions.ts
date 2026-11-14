"use server";

import { redirect } from "next/navigation";
import { getUser, updatePassword } from "@/server/auth";

export type PwState = { error?: string; field?: "password" | "confirm" };

export async function setPasswordAction(_: PwState, form: FormData): Promise<PwState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Minimal 10 karakter.", field: "password" };
  if (password !== confirm) return { error: "Kedua password tidak sama.", field: "confirm" };
  const user = await getUser();
  if (!user) return { error: "Sesi atur password sudah habis. Buka lagi link dari email atau halaman pesanan." };
  const err = await updatePassword(user.id, password);
  if (err) return { error: `Gagal menyimpan password: ${err}`, field: "password" };
  redirect("/kantor-saya");
}
