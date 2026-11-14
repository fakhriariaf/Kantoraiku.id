import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, one, sessionSecret, type Sql } from "./db";
import { hashPassword, randomToken, sha256, sign, unsign, verifyPassword } from "./crypto";

/**
 * Login dev: email + password, sesi di cookie bertanda tangan HMAC.
 * /replica-backend menggantinya dengan Supabase Auth; pemanggil cukup memakai
 * getUser / requireMember / requireAdmin, jadi layar tidak perlu berubah.
 */

const COOKIE = "k_sess";
const MAX_AGE_S = 60 * 60 * 24 * 30;

export type User = { id: string; email: string };
export type Office = {
  id: string;
  slug: string;
  display_name: string;
  timezone: string;
  status: string;
  role: "owner" | "member";
};

export async function getUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const value = unsign(raw, sessionSecret());
  if (!value) return null;
  const [id, exp] = value.split("|");
  if (!id || Number(exp) < Date.now()) return null;
  return one<User>(await db(), `select id, email from auth.users where id = $1`, [id]);
}

async function startSession(userId: string) {
  const value = sign(`${userId}|${Date.now() + MAX_AGE_S * 1000}`, sessionSecret());
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function signInWithPassword(email: string, password: string): Promise<boolean> {
  const u = await one<{ id: string; password_hash: string | null }>(
    await db(),
    `select id, password_hash from auth.users where email = $1`,
    [email.trim().toLowerCase()],
  );
  // Tetap hitung hash walau user tidak ada, supaya waktu respons tidak membocorkan email terdaftar.
  const ok = await verifyPassword(password, u?.password_hash ?? "scrypt$AAAA$AAAA");
  if (!u || !ok) return false;
  await startSession(u.id);
  return true;
}

export async function ensureUser(sql: Sql, email: string): Promise<string> {
  const e = email.trim().toLowerCase();
  const existing = await one<{ id: string }>(sql, `select id from auth.users where email = $1`, [e]);
  if (existing) return existing.id;
  const created = await one<{ id: string }>(sql, `insert into auth.users (email) values ($1) returning id`, [e]);
  return created!.id;
}

export async function hasPassword(sql: Sql, userId: string) {
  const r = await one<{ has: boolean }>(sql, `select password_hash is not null as has from auth.users where id = $1`, [userId]);
  return !!r?.has;
}

/** Token "atur password" (pengganti undangan Supabase), berlaku 7 hari. */
export async function createSetPasswordToken(sql: Sql, userId: string) {
  const token = randomToken();
  await sql.query(
    `insert into auth.one_time_tokens (token_hash, user_id, purpose, expires_at)
     values ($1, $2, 'set_password', now() + interval '7 days')`,
    [sha256(token), userId],
  );
  return token;
}

export async function consumeSetPasswordToken(token: string, password: string): Promise<User | null> {
  const d = await db();
  const hash = await hashPassword(password);
  const user = await d.transaction(async (tx) => {
    const t = await one<{ user_id: string }>(
      tx,
      `update auth.one_time_tokens set used_at = now()
        where token_hash = $1 and purpose = 'set_password' and used_at is null and expires_at > now()
        returning user_id`,
      [sha256(token)],
    );
    if (!t) return null;
    return one<User>(tx, `update auth.users set password_hash = $2 where id = $1 returning id, email`, [t.user_id, hash]);
  });
  if (user) await startSession(user.id);
  return user;
}

export async function isPlatformAdmin(userId: string) {
  return !!(await one(await db(), `select 1 from public.platform_admins where user_id = $1`, [userId]));
}

export async function requireAdmin(): Promise<User> {
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

/** Pintu semua halaman kantor: login dulu, lalu harus anggota kantor itu. */
export async function requireMember(slug: string): Promise<{ user: User; office: Office }> {
  const exists = await one(await db(), `select 1 from public.offices where slug = $1 and status <> 'closed'`, [slug]);
  if (!exists) notFound();
  const user = await getUser();
  if (!user) redirect(`/o/${slug}/masuk`);
  const office = await getOfficeForUser(slug, user.id);
  if (!office) redirect(`/o/${slug}/masuk?e=bukan-anggota`);
  return { user, office };
}
