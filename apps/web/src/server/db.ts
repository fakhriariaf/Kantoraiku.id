import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Koneksi server ke Postgres Supabase (lokal: `supabase start`, cloud: pooler mode transaksi).
 * Koneksi ini melewati RLS, jadi setiap fungsi di src/server/* memfilter office_id yang sudah
 * dicek lewat requireMember()/requireAdmin()/authDevice() (cek di data layer, lihat architecture.md).
 * Antarmuka query/transaction sama dengan versi PGlite sebelumnya. Parameter jsonb dikirim sebagai
 * objek/array JS (postgres v4 men-serialize sendiri); jangan JSON.stringify, nanti tersimpan sebagai string.
 */

type Pg = postgres.Sql | postgres.TransactionSql;
type Result<T> = { rows: T[]; affectedRows: number };

export type Sql = { query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<Result<T>> };
export type Db = Sql & { transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T> };

/** Folder data lokal yang tidak di-commit (kredensial dev). */
export const DATA_DIR = join(process.cwd(), ".data");
mkdirSync(DATA_DIR, { recursive: true });

function wrap(pg: Pg): Sql {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      const r = await pg.unsafe(text, params as never[]);
      return { rows: r as unknown as T[], affectedRows: r.count ?? 0 };
    },
  };
}

const g = globalThis as typeof globalThis & { __kpg?: postgres.Sql };

function pool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi (lihat apps/web/.env.example).");
  // prepare:false: wajib untuk pooler Supabase mode transaksi.
  g.__kpg ??= postgres(url, { prepare: false, max: 10, idle_timeout: 20, connection: { application_name: "kantoraiku-web" } });
  return g.__kpg;
}

export async function db(): Promise<Db> {
  const pg = pool();
  return { ...wrap(pg), transaction: (fn) => pg.begin((tx) => fn(wrap(tx))) as never };
}

export async function one<T>(sql: Sql, q: string, params: unknown[] = []): Promise<T | null> {
  const r = await sql.query<T>(q, params);
  return r.rows[0] ?? null;
}

export async function many<T>(sql: Sql, q: string, params: unknown[] = []): Promise<T[]> {
  return (await sql.query<T>(q, params)).rows;
}
