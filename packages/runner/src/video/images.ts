import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VideoVisual } from "@kantoraiku/shared";
import { BrainError } from "../brains/types.ts";
import { pexelsKeyStatus } from "./sources.ts";

// Gambar AI per adegan (digerakkan FFmpeg menjadi video). Dibayar dengan kunci API milik user di PC.
//   fal:    FLUX schnell lewat https://fal.run (murah, cepat). Kunci FAL_KEY.
//   openai: GPT Image lewat /v1/images/generations. Kunci OPENAI_API_KEY (sama dengan otak agent).

const FAL = () => process.env.FAL_BASE_URL || "https://fal.run";
const OPENAI = () => process.env.OPENAI_IMAGE_BASE_URL || "https://api.openai.com";

export const falKeyStatus = () => (process.env.FAL_KEY ? "ok" : "missing_key");
const openaiKey = () => (process.env.OPENAI_API_KEY ? "ok" : "missing_key");

export type ImageProvider = "ai_fal" | "ai_openai";
export type ResolvedVisual = ImageProvider | "stock" | "plain";

const NAMES: Record<ImageProvider, string> = { ai_fal: "fal (FLUX)", ai_openai: "OpenAI" };

/**
 * Sumber visual yang dipakai untuk satu video. Pilihan eksplisit tanpa kunci = galat yang jelas
 * (pemilik memilihnya sendiri); "auto" turun ke pilihan berikutnya tanpa biaya tak terduga.
 */
export function resolveVisual(choice: VideoVisual): ResolvedVisual {
  switch (choice) {
    case "ai_fal":
      if (falKeyStatus() !== "ok") throw new BrainError("Channel ini memakai gambar AI fal, tapi kunci fal belum diisi. Isi di dashboard, Pengaturan › Kunci & layanan.");
      return "ai_fal";
    case "ai_openai":
      if (openaiKey() !== "ok") throw new BrainError("Channel ini memakai gambar AI OpenAI, tapi kunci OpenAI belum diisi. Isi di dashboard, Pengaturan › Kunci & layanan.");
      return "ai_openai";
    case "stock":
      if (pexelsKeyStatus() !== "ok") throw new BrainError("Channel ini memakai footage stok Pexels, tapi kunci Pexels belum diisi. Isi di dashboard, Pengaturan › Kunci & layanan.");
      return "stock";
    case "plain":
      return "plain";
    case "auto":
      if (falKeyStatus() === "ok") return "ai_fal";
      if (pexelsKeyStatus() === "ok") return "stock";
      return "plain";
  }
}

/** Prompt gambar: adegan + gaya channel, potret, tanpa teks (subtitle ditambahkan sendiri saat render). */
export function imagePrompt(scene: { visual: string; text: string }, opts: { title: string; style: string; niche: string }) {
  const subject = scene.visual || scene.text || opts.title;
  const style = opts.style.trim() || "cinematic realistic photo, soft natural light, shallow depth of field";
  return [
    `Vertical 9:16 frame for a short social video about "${opts.title}".`,
    `Scene: ${subject}.`,
    opts.niche ? `Channel topic: ${opts.niche.slice(0, 200)}.` : "",
    `Visual style: ${style}.`,
    "No text, no letters, no captions, no logos, no watermark. Leave the lower third uncluttered for subtitles.",
  ]
    .filter(Boolean)
    .join(" ");
}

export const IMAGE_SIZE: Record<ImageProvider, { width: number; height: number }> = {
  ai_fal: { width: 768, height: 1344 },
  ai_openai: { width: 1024, height: 1536 },
};

/**
 * Buat (atau ambil dari cache) satu gambar. Cache memakai hash penyedia + prompt + seed, jadi render ulang
 * tidak membayar lagi; revisi video memakai seed lain supaya gambarnya berganti.
 */
export async function generateImage(provider: ImageProvider, prompt: string, opts: { cacheDir: string; seed: number }): Promise<string> {
  const model = provider === "ai_fal" ? process.env.FAL_IMAGE_MODEL || "fal-ai/flux/schnell" : process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
  const key = createHash("sha256").update(`${provider}|${model}|${opts.seed}|${prompt}`).digest("hex").slice(0, 24);
  mkdirSync(opts.cacheDir, { recursive: true });
  const path = join(opts.cacheDir, `ai-${key}.jpg`);
  if (existsSync(path)) return path;

  const bytes = provider === "ai_fal" ? await falImage(model, prompt, opts.seed) : await openaiImage(model, prompt);
  const tmp = `${path}.part`;
  await writeFile(tmp, bytes);
  renameSync(tmp, path);
  return path;
}

async function post(provider: ImageProvider, url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  try {
    return await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
  } catch {
    throw new BrainError(`Tidak bisa terhubung ke ${NAMES[provider]}. Periksa internet PC ini.`);
  }
}

async function check(provider: ImageProvider, res: Response) {
  if (res.ok) return;
  const name = NAMES[provider];
  if (res.status === 401 || res.status === 403) throw new BrainError(`Kunci ${name} ditolak (${res.status}). Periksa kuncinya di Pengaturan › Kunci & layanan.`);
  if (res.status === 402) throw new BrainError(`Saldo ${name} habis (402). Isi saldo di akun ${name} kamu.`);
  if (res.status === 429) throw new BrainError(`Batas permintaan atau kuota ${name} habis (429). Coba lagi nanti.`);
  const text = (await res.text().catch(() => "")).slice(0, 200);
  // Ditolak filter keamanan atau prompt tidak valid: adegan ini memakai latar polos, video tetap jadi.
  if (res.status === 400 || res.status === 422) throw new ImageRejected(`${name} menolak gambar adegan ini: ${text}`);
  throw new BrainError(`${name} error ${res.status}: ${text}`);
}

/** Gambar satu adegan ditolak (mis. filter keamanan); render lanjut dengan latar polos untuk adegan itu. */
export class ImageRejected extends Error {}

async function falImage(model: string, prompt: string, seed: number): Promise<Uint8Array> {
  const res = await post("ai_fal", `${FAL()}/${model}`, { authorization: `Key ${process.env.FAL_KEY ?? ""}` }, {
    prompt,
    image_size: IMAGE_SIZE.ai_fal,
    num_images: 1,
    seed,
    output_format: "jpeg",
    enable_safety_checker: true,
  });
  await check("ai_fal", res);
  const data = (await res.json()) as { images?: { url?: string }[]; has_nsfw_concepts?: boolean[] };
  if (data.has_nsfw_concepts?.[0]) throw new ImageRejected("fal menandai gambar adegan ini tidak aman.");
  const url = data.images?.[0]?.url;
  if (!url) throw new BrainError("fal tidak mengembalikan gambar.");
  if (url.startsWith("data:")) return new Uint8Array(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!img?.ok) throw new BrainError("Gagal mengunduh gambar dari fal.");
  return new Uint8Array(await img.arrayBuffer());
}

async function openaiImage(model: string, prompt: string): Promise<Uint8Array> {
  const { width, height } = IMAGE_SIZE.ai_openai;
  const res = await post("ai_openai", `${OPENAI()}/v1/images/generations`, { authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}` }, {
    model,
    prompt,
    n: 1,
    size: `${width}x${height}`,
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    output_format: "jpeg",
  });
  await check("ai_openai", res);
  const data = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new BrainError("OpenAI tidak mengembalikan gambar.");
  return new Uint8Array(Buffer.from(b64, "base64"));
}
