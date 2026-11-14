import "server-only";
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/**
 * Database dev: PGlite (Postgres di dalam proses Node) dengan skema yang sama
 * dengan production (replica/schema.sql). /replica-backend menggantinya dengan
 * Supabase; fungsi-fungsi di src/server/* tidak berubah karena semuanya SQL.
 */

export type Sql = Pick<PGlite, "query"> | Transaction;

const REPO_ROOT = resolve(process.cwd(), "..", "..");
export const DATA_DIR = join(process.cwd(), ".data");

// Pengganti bagian Supabase yang tidak ada di PGlite.
const SUPABASE_SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  password_hash text,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema cron;
create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create publication supabase_realtime;

-- Token sekali pakai untuk login dev (Supabase Auth menggantikannya).
create table auth.one_time_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('set_password')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
`;

type G = typeof globalThis & { __kdb?: Promise<PGlite>; __kcron?: NodeJS.Timeout };
const g = globalThis as G;

async function open(): Promise<PGlite> {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = await PGlite.create({ dataDir: join(DATA_DIR, "pglite"), extensions: { pgcrypto } });
  await db.exec(`create table if not exists public._dev_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set(
    (await db.query<{ name: string }>(`select name from public._dev_migrations`)).rows.map((r) => r.name),
  );

  const migrations: [string, () => string][] = [
    ["0000_supabase_shim", () => SUPABASE_SHIM],
    [
      "0001_init",
      () =>
        readFileSync(join(REPO_ROOT, "replica", "schema.sql"), "utf8").replace(
          /create extension if not exists pg_cron;/,
          "",
        ),
    ],
  ];
  for (const [name, sql] of migrations) {
    if (done.has(name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(sql());
      await tx.query(`insert into public._dev_migrations (name) values ($1)`, [name]);
    });
    console.log(`[db] migrasi ${name} diterapkan`);
  }

  if (process.env.NODE_ENV !== "production") await ensureDevAdmin(db);
  startDevCron(db);
  return db;
}

/**
 * Admin platform untuk dev. Kredensial dari DEV_ADMIN_EMAIL/DEV_ADMIN_PASSWORD,
 * atau dibuat acak sekali dan ditulis ke .data/dev-credentials.txt (tidak di-commit).
 */
async function ensureDevAdmin(db: PGlite) {
  const has = await db.query(`select 1 from public.platform_admins limit 1`);
  if (has.rows.length) return;
  const { hashPassword } = await import("./crypto");
  const email = (process.env.DEV_ADMIN_EMAIL ?? "admin@kantoraiku.test").toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  const hash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const u = await tx.query<{ id: string }>(
      `insert into auth.users (email, password_hash) values ($1, $2)
       on conflict (email) do update set password_hash = excluded.password_hash returning id`,
      [email, hash],
    );
    await tx.query(`insert into public.platform_admins (user_id) values ($1) on conflict do nothing`, [u.rows[0].id]);
  });
  if (!process.env.DEV_ADMIN_PASSWORD) {
    writeFileSync(
      join(DATA_DIR, "dev-credentials.txt"),
      `Admin dev Kantoraiku (lokal saja, jangan dipakai di production)\nURL: http://localhost:3000/admin/masuk\nEmail: ${email}\nPassword: ${password}\n`,
    );
    console.log(`[db] admin dev dibuat; kredensial di ${join(DATA_DIR, "dev-credentials.txt")}`);
  }
}

/** Pengganti pg_cron di dev: jalankan fungsi jadwal tiap 30 detik. */
function startDevCron(db: PGlite) {
  if (g.__kcron) clearInterval(g.__kcron);
  const tick = async () => {
    try {
      await db.exec(`
        select public.enqueue_due_tasks();
        select public.requeue_expired_leases();
        select public.mark_devices_offline();
        select public.expire_pending_orders();
      `);
    } catch (e) {
      console.error("[db] dev cron gagal", e);
    }
  };
  g.__kcron = setInterval(tick, 30_000);
  void tick();
}

export function db(): Promise<PGlite> {
  g.__kdb ??= open();
  return g.__kdb;
}

/** Rahasia sesi dev: dari env, atau dibuat sekali dan disimpan di .data (tidak di-commit). */
export function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = join(DATA_DIR, "session-secret");
  if (!existsSync(f)) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(f, randomBytes(32).toString("hex"));
  }
  return readFileSync(f, "utf8").trim();
}

export async function one<T>(sql: Sql, q: string, params: unknown[] = []): Promise<T | null> {
  const r = await sql.query<T>(q, params);
  return r.rows[0] ?? null;
}

export async function many<T>(sql: Sql, q: string, params: unknown[] = []): Promise<T[]> {
  return (await sql.query<T>(q, params)).rows;
}
