// Tipe dan validasi yang dipakai proses utama dan tampilan.

export type AiState = "ok" | "missing_key" | "invalid_key";

export type UiState = {
  version: string;
  defaultServer: string;
  defaultName: string;
  office: { name: string; slug: string; server: string } | null;
  status: "unpaired" | "connecting" | "online" | "working" | "offline" | "paused";
  current: { agent: string; task: string; pct: number; message: string } | null;
  ai: { simulation: AiState; openai: AiState; claude: AiState };
  activity: { at: string; text: string; tone: "info" | "ok" | "error" }[];
  autoStart: boolean;
  /** Start otomatis hanya untuk aplikasi terpasang (bukan mode dev). */
  autoStartAvailable: boolean;
  update: { version: string } | null;
  notice: { tone: "ok" | "error"; text: string } | null;
};

export type PairInput = { code: string; name?: string; server?: string };

/** Kode setup dari dashboard: 8 huruf/angka, boleh ditempel dengan spasi atau tanda hubung. */
export function normalizeCode(raw: string): string | null {
  const code = String(raw ?? "").replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,32}$/.test(code) ? code : null;
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Token perangkat tidak boleh lewat koneksi tanpa enkripsi, kecuali server lokal untuk pengembangan. */
export function checkServer(raw: string): { url: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return { error: "Alamat server tidak valid. Contoh: https://kantoraiku.id" };
  }
  if (u.protocol === "https:" || (u.protocol === "http:" && LOCAL.has(u.hostname))) return { url: u.origin };
  return { error: "Alamat server harus diawali https://" };
}
