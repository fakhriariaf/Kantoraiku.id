import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Kode tanpa huruf/angka yang mirip (0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function humanCode(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string | null) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, saltB64, keyB64] = stored.split("$");
  const key = Buffer.from(keyB64, "base64");
  const test = await scryptAsync(pw, Buffer.from(saltB64, "base64"), key.length);
  return timingSafeEqual(key, test);
}

export function sign(value: string, secret: string) {
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

export function unsign(signed: string, secret: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const a = Buffer.from(sign(value, secret));
  const b = Buffer.from(signed);
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}
