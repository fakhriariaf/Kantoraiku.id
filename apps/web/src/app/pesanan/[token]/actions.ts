"use server";

import { redirect } from "next/navigation";
import { db, one } from "@/server/db";
import { createSetPasswordToken, ensureUser, hasPassword } from "@/server/auth";
import { getOrderByToken } from "@/server/orders";

/**
 * Pemegang link pesanan (rahasia, dikirim ke pembeli) boleh mengatur password pertama.
 * Bila password sudah ada, langsung ke halaman masuk kantor.
 */
export async function startSetPassword(orderToken: string) {
  const o = await getOrderByToken(orderToken);
  if (!o || o.status !== "paid") redirect(`/pesanan/${orderToken}`);
  const d = await db();
  const userId = await ensureUser(d, o.buyer_email);
  if (await hasPassword(d, userId)) redirect(`/o/${o.office_slug}/masuk`);
  const office = await one<{ slug: string }>(d, `select slug from public.offices where id = $1`, [o.office_id]);
  const token = await createSetPasswordToken(d, userId);
  redirect(`/atur-password?token=${encodeURIComponent(token)}&kantor=${office?.slug ?? ""}`);
}
