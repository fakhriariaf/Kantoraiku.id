"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isPlatformAdmin, requireAdmin, signInWithPassword, signOut, getUser } from "@/server/auth";
import { cancelOrder, confirmManualPayment } from "@/server/orders";
import { allow, TOO_MANY } from "@/server/rate-limit";

export type LoginState = { error?: string };

export async function adminLogin(_: LoginState, form: FormData): Promise<LoginState> {
  if (!(await allow("admin-login", 10, 600))) return { error: TOO_MANY };
  const ok = await signInWithPassword(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return { error: "Email atau password salah." };
  const u = await getUser();
  if (!u || !(await isPlatformAdmin(u.id))) {
    await signOut();
    return { error: "Akun ini bukan admin." };
  }
  redirect("/admin");
}

export async function adminLogout() {
  await signOut();
  redirect("/admin/masuk");
}

export type ConfirmState = { error?: string };

export async function confirmPayment(orderId: string, _: ConfirmState, form: FormData): Promise<ConfirmState> {
  const admin = await requireAdmin();
  const note = String(form.get("note") ?? "").trim() || null;
  try {
    await confirmManualPayment(orderId, admin.id, note);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengonfirmasi." };
  }
  revalidatePath("/admin");
  redirect(`/admin/pesanan/${orderId}?ok=lunas`);
}

export async function cancel(orderId: string, form: FormData) {
  await requireAdmin();
  await cancelOrder(orderId, String(form.get("note") ?? "").trim() || null);
  redirect(`/admin/pesanan/${orderId}?ok=batal`);
}
