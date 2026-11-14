import "server-only";
import { headers } from "next/headers";
import { db, one } from "./db";
import { sha256 } from "./crypto";

/** IP klien dari header proxy (Vercel/Cloudflare). Hanya di-hash, tidak pernah disimpan mentah. */
async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/**
 * true = boleh lanjut. Contoh: allow("order", 5, 600) -> maks 5 pesanan per 10 menit per IP.
 * `extra` menambah dimensi kunci, mis. email (juga di-hash).
 */
export async function allow(action: string, max: number, windowSeconds: number, extra = "") {
  const key = sha256(`${action}:${await clientIp()}:${extra.toLowerCase()}`);
  const r = await one<{ ok: boolean }>(await db(), `select public.hit_rate_limit($1, $2, $3) as ok`, [key, windowSeconds, max]);
  return !!r?.ok;
}

/** Untuk route handler (Request langsung, tanpa next/headers). */
export async function allowRequest(req: Request, action: string, max: number, windowSeconds: number) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
  const r = await one<{ ok: boolean }>(await db(), `select public.hit_rate_limit($1, $2, $3) as ok`, [
    sha256(`${action}:${ip}`),
    windowSeconds,
    max,
  ]);
  return !!r?.ok;
}

export const TOO_MANY = "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.";
