"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ensureUser, hasPassword, signInForPasswordSetup } from "@/server/auth";
import { getOrderByToken } from "@/server/orders";

/**
 * Pemegang link pesanan (rahasia, hanya dimiliki pembeli) boleh mengatur password pertama.
 * Bila password sudah pernah diatur, langsung ke halaman masuk kantor.
 */
export async function startSetPassword(orderToken: string) {
  const o = await getOrderByToken(orderToken);
  if (!o || o.status !== "paid") redirect(`/pesanan/${orderToken}`);
  const userId = await ensureUser(o.buyer_email);
  if (await hasPassword(await db(), userId)) redirect(`/o/${o.office_slug}/masuk`);
  await signInForPasswordSetup(o.buyer_email);
  redirect("/atur-password");
}
