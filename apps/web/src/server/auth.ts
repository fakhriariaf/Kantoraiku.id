import "server-only";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { db, one, type Sql } from "./db";
import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseAdmin } from "./supabase";

/**
 * Login lewat Supabase Auth (email + password, link reset, magic link).
 * Pemanggil memakai getUser / requireMember / requireAdmin; layar tidak tahu penyedia login-nya.
 */

export type User = { id: string; email: string };
export type Office = {
  id: string;
  slug: string;
  display_name: string;
  timezone: string;
  status: string;
  role: "owner" | "member";
};

/** User dari JWT sesi (diverifikasi oleh Supabase Auth). */
export async function getUser(): Promise<User | null> {
  const { data } = await (await supabase()).auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  return { id: c.sub, email: String(c.email ?? "") };
}

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const { error } = await (await supabase()).auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return !error;
}

export async function signOut(scope: "local" | "global" = "local") {
  await (await supabase()).auth.signOut({ scope });
}

/**
 * Cek password tanpa menyentuh sesi browser ini: masuk lewat client sekali pakai (tanpa cookie),
 * lalu sesi sementaranya langsung dicabut.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) return false;
  await c.auth.signOut({ scope: "local" }); // local: hanya sesi sementara ini, sesi browser tetap
  return true;
}

/** Ganti password user yang sedang login (setelah membuka link reset), lalu tandai password_set. */
export async function updatePassword(userId: string, password: string) {
  const { error } = await (await supabase()).auth.updateUser({ password });
  if (error) return error.message;
  // app_metadata hanya bisa diubah server (bukan user), jadi aman dipakai sebagai penanda.
  await supabaseAdmin().auth.admin.updateUserById(userId, { app_metadata: { password_set: true } });
  return null;
}

/** Kirim link masuk (magic link). Tidak membuat user baru; diam bila email tidak terdaftar. */
export async function sendMagicLink(email: string) {
  await (await supabase()).auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
}

/** Kirim email reset password. Diam bila email tidak terdaftar (anti-enumerasi). */
export async function sendPasswordReset(email: string) {
  await (await supabase()).auth.resetPasswordForEmail(email.trim().toLowerCase());
}

/** Buat (atau pakai ulang) user Auth untuk pembeli. Di luar transaksi DB karena lewat API Auth. */
export async function ensureUser(email: string): Promise<string> {
  const e = email.trim().toLowerCase();
  const existing = await one<{ id: string }>(await db(), `select id from auth.users where lower(email) = $1`, [e]);
  if (existing) return existing.id;
  const { data, error } = await supabaseAdmin().auth.admin.createUser({ email: e, email_confirm: true });
  if (error || !data.user) throw new Error(`Gagal membuat akun: ${error?.message ?? "tanpa user"}`);
  return data.user.id;
}

/**
 * Sudah mengatur password sendiri? Supabase Auth mengisi password acak saat akun dibuat tanpa
 * password, jadi encrypted_password tidak bisa dipakai; penandanya app_metadata.password_set.
 */
export async function hasPassword(sql: Sql, userId: string) {
  const r = await one<{ has: boolean }>(
    sql,
    `select coalesce((raw_app_meta_data ->> 'password_set')::boolean, false) as has from auth.users where id = $1`,
    [userId],
  );
  return !!r?.has;
}

/**
 * Masuk sebagai pembeli untuk mengatur password pertama (pengganti undangan).
 * Token recovery dibuat lalu langsung ditukar jadi sesi DI SERVER ACTION yang sama, sehingga
 * sesi lain yang masih aktif di browser (mis. admin) pasti diganti sebelum /atur-password dirender,
 * dan token tidak pernah muncul di URL. Wajib dipanggil dari server action (menulis cookie).
 */
export async function signInForPasswordSetup(email: string) {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "recovery", email: email.trim().toLowerCase() });
  if (error || !data.properties?.hashed_token) throw new Error(`Gagal membuat token: ${error?.message ?? "tanpa token"}`);
  const sb = await supabase();
  await sb.auth.signOut({ scope: "local" });
  const v = await sb.auth.verifyOtp({ type: "recovery", token_hash: data.properties.hashed_token });
  if (v.error || v.data.user?.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error(`Gagal masuk untuk atur password: ${v.error?.message ?? "akun tidak cocok"}`);
  }
}

export async function isPlatformAdmin(userId: string) {
  return !!(await one(await db(), `select 1 from public.platform_admins where user_id = $1`, [userId]));
}

export async function requireAdmin(): Promise<User> {
  await connection(); // data per-request: jangan di-prerender
  const u = await getUser();
  if (!u) redirect("/admin/masuk");
  if (!(await isPlatformAdmin(u.id))) redirect("/admin/masuk?e=bukan-admin");
  return u;
}

export async function getOfficeForUser(slug: string, userId: string) {
  return one<Office>(
    await db(),
    `select o.id, o.slug, o.display_name, o.timezone, o.status, m.role
       from public.offices o
       join public.office_members m on m.office_id = o.id and m.user_id = $2
      where o.slug = $1`,
    [slug, userId],
  );
}

export async function listOfficesForUser(userId: string) {
  return (
    await (await db()).query<{ slug: string; display_name: string }>(
      `select o.slug, o.display_name from public.office_members m join public.offices o on o.id = m.office_id
        where m.user_id = $1 and o.status <> 'closed' order by m.created_at`,
      [userId],
    )
  ).rows;
}

/** Pintu semua halaman kantor: login dulu, lalu harus anggota kantor itu. */
export async function requireMember(slug: string): Promise<{ user: User; office: Office }> {
  await connection(); // data per-request: jangan di-prerender
  const exists = await one(await db(), `select 1 from public.offices where slug = $1 and status <> 'closed'`, [slug]);
  if (!exists) notFound();
  const user = await getUser();
  if (!user) redirect(`/o/${slug}/masuk`);
  const office = await getOfficeForUser(slug, user.id);
  if (!office) redirect(`/o/${slug}/masuk?e=bukan-anggota`);
  return { user, office };
}
