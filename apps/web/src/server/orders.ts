import "server-only";
import { z } from "zod";
import { db, many, one, type Sql } from "./db";
import { config } from "./config";
import { humanCode, randomToken } from "./crypto";
import { ensureUser } from "./auth";
import { nameFromSlug } from "@/lib/format";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export type SlugStatus = { ok: true } | { ok: false; reason: string };

export async function slugStatus(slugRaw: string, sql?: Sql): Promise<SlugStatus> {
  const slug = slugRaw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { ok: false, reason: "Pakai 3-30 huruf kecil, angka, atau tanda hubung, tanpa tanda hubung di awal/akhir." };
  }
  const s = sql ?? (await db());
  const taken = await one<{ why: string }>(
    s,
    `select 'reserved' as why from public.reserved_slugs where slug = $1
     union all select 'office' from public.offices where slug = $1
     union all select 'pending' from public.orders where office_slug = $1 and status = 'pending'
     limit 1`,
    [slug],
  );
  if (taken?.why === "reserved") return { ok: false, reason: "Alamat ini dipakai sistem. Pilih yang lain." };
  if (taken) return { ok: false, reason: "Alamat ini sudah dipakai. Coba yang lain." };
  return { ok: true };
}

export const OrderInput = z.object({
  name: z.string().trim().min(2, "Isi nama kamu.").max(120),
  email: z.email("Format email belum benar.").trim().toLowerCase(),
  whatsapp: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+?62|0)8[0-9]{7,12}$/, "Nomor WhatsApp belum benar, contoh 081234567890.")),
  slug: z.string().trim().toLowerCase(),
});
export type OrderInput = z.infer<typeof OrderInput>;

function orderCode() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `KTR-${ymd}-${humanCode(4)}`;
}

/** Buat pesanan transfer manual. Mengembalikan token halaman pesanan. */
export async function createManualOrder(input: OrderInput): Promise<{ token: string } | { slugError: string }> {
  const d = await db();
  const st = await slugStatus(input.slug, d);
  if (!st.ok) return { slugError: st.reason };
  const token = randomToken(24);
  try {
    await d.query(
      `insert into public.orders
         (code, public_token, buyer_name, buyer_email, buyer_whatsapp, office_slug, amount, payment_method, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'manual', now() + make_interval(hours => $8))`,
      [orderCode(), token, input.name, input.email, input.whatsapp, input.slug, config.priceLifetimeIdr, config.manualPaymentHours],
    );
  } catch (e) {
    // Balapan: orang lain memesan slug yang sama di detik yang sama (indeks orders_pending_slug).
    if (String(e).includes("orders_pending_slug")) return { slugError: "Alamat ini baru saja dipesan orang lain. Coba yang lain." };
    throw e;
  }
  return { token };
}

export type OrderRow = {
  id: string;
  code: string;
  public_token: string;
  buyer_name: string;
  buyer_email: string;
  buyer_whatsapp: string;
  office_slug: string;
  amount: number;
  payment_method: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "refunded";
  paid_at: string | null;
  expires_at: string;
  created_at: string;
  admin_note: string | null;
  office_id: string | null;
};

export async function getOrderByToken(token: string) {
  return one<OrderRow>(await db(), `select * from public.orders where public_token = $1`, [token]);
}

export async function getOrder(id: string) {
  return one<OrderRow & { confirmed_by_email: string | null }>(
    await db(),
    `select o.*, u.email as confirmed_by_email from public.orders o
       left join auth.users u on u.id = o.confirmed_by where o.id = $1`,
    [id],
  );
}

export async function listOrders(status?: string) {
  return many<OrderRow>(
    await db(),
    `select * from public.orders where ($1::text is null or status = $1) order by created_at desc limit 200`,
    [status ?? null],
  );
}

/**
 * Admin menandai transfer manual lunas -> kantor dibuat.
 * Idempoten: klik dobel tidak membuat dua kantor (offices.order_id unik + cek status).
 */
export async function confirmManualPayment(orderId: string, adminId: string, note: string | null) {
  const d = await db();
  const pre = await one<OrderRow>(d, `select * from public.orders where id = $1`, [orderId]);
  if (!pre) throw new Error("Pesanan tidak ditemukan.");
  // Akun dibuat lewat API Auth (bukan SQL), jadi di luar transaksi. Idempoten: email yang sama dipakai ulang.
  const ownerId = await ensureUser(pre.buyer_email);
  return d.transaction(async (tx) => {
    const o = await one<OrderRow>(tx, `select * from public.orders where id = $1 for update`, [orderId]);
    if (!o) throw new Error("Pesanan tidak ditemukan.");
    if (o.status === "paid") return { already: true as const };
    if (o.payment_method !== "manual") throw new Error("Hanya pesanan transfer manual yang bisa dikonfirmasi di sini.");
    if (o.status !== "pending" && o.status !== "expired") throw new Error(`Pesanan berstatus ${o.status}.`);
    if (o.status === "expired") {
      const st = await slugStatus(o.office_slug, tx);
      if (!st.ok) throw new Error(`Alamat ${o.office_slug} sudah dipakai pesanan lain. ${st.reason}`);
    }
    await tx.query(
      `update public.orders set status = 'paid', paid_at = now(), confirmed_by = $2, admin_note = $3 where id = $1`,
      [orderId, adminId, note],
    );
    await tx.query(
      `insert into public.payment_events (order_id, provider, provider_event_key, transaction_status, payload)
       values ($1, 'manual', $2, 'settlement', $3) on conflict do nothing`,
      [orderId, `manual:${orderId}`, { confirmed_by: adminId, note }],
    );
    const officeId = await provisionOffice(tx, { ...o, status: "paid" }, ownerId);
    return { already: false as const, officeId };
  });
}

export async function cancelOrder(orderId: string, note: string | null) {
  const r = await (await db()).query(
    `update public.orders set status = 'cancelled', admin_note = $2 where id = $1 and status in ('pending','expired')`,
    [orderId, note],
  );
  return (r.affectedRows ?? 0) > 0;
}

/** Buat kantor + pemilik + agent asisten bawaan. Idempoten per pesanan. */
export async function provisionOffice(tx: Sql, o: OrderRow, userId: string): Promise<string> {
  const existing = await one<{ id: string }>(tx, `select id from public.offices where order_id = $1`, [o.id]);
  if (existing) return existing.id;
  const office = await one<{ id: string }>(
    tx,
    `insert into public.offices (slug, display_name, order_id) values ($1, $2, $3) returning id`,
    [o.office_slug, nameFromSlug(o.office_slug), o.id],
  );
  const officeId = office!.id;
  await tx.query(`insert into public.office_members (office_id, user_id, role) values ($1, $2, 'owner')`, [officeId, userId]);
  await tx.query(`update public.orders set office_id = $2 where id = $1`, [o.id, officeId]);
  await tx.query(
    `insert into public.agents (office_id, name, title, job_description, kind, brain, color, desk_index)
     values ($1, 'Asisten', 'Asisten setup', 'Membantu kamu menyiapkan kantor lewat chat.', 'assistant', 'simulation', '#4b5563', 0)`,
    [officeId],
  );
  await tx.query(
    `insert into public.activity_events (office_id, kind, text) values ($1, 'office.created', 'Kantor dibuat. Selamat datang!')`,
    [officeId],
  );
  return officeId;
}
