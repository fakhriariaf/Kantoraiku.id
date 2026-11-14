import "server-only";
import { connection } from "next/server";

/** Waktu saat request (untuk label "5 menit lalu"). Menandai render sebagai per-request. */
export async function requestNow() {
  await connection();
  return Date.now();
}
