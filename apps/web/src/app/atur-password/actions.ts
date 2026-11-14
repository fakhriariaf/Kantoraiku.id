"use server";

import { redirect } from "next/navigation";
import { consumeSetPasswordToken } from "@/server/auth";
import { db, one } from "@/server/db";

export type PwState = { error?: string; field?: "password" | "confirm" };

export async function setPasswordAction(_: PwState, form: FormData): Promise<PwState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 10) return { error: "Minimal 10 karakter.", field: "password" };
  if (password !== confirm) return { error: "Kedua password tidak sama.", field: "confirm" };
  const user = await consumeSetPasswordToken(token, password);
  if (!user) return { error: "Link ini sudah dipakai atau kedaluwarsa. Buka lagi halaman pesanan untuk membuat link baru." };
  const office = await one<{ slug: string }>(
    await db(),
    `select o.slug from public.office_members m join public.offices o on o.id = m.office_id
      where m.user_id = $1 order by m.created_at limit 1`,
    [user.id],
  );
  redirect(office ? `/o/${office.slug}` : "/");
}
