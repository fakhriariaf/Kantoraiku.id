import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BrainError } from "../brains/types.ts";

// Sumber bahan video: suara narasi (ElevenLabs) dan footage (Pexels).
// Keduanya memakai API key milik user di PC; tanpa kunci, konektor memakai suara simulasi (diam)
// dan latar warna, sehingga alur tetap bisa dicoba.

const ELEVENLABS = () => process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";
const PEXELS = () => process.env.PEXELS_BASE_URL || "https://api.pexels.com";

export const elevenlabsKeyStatus = () => (process.env.ELEVENLABS_API_KEY ? "ok" : "missing_key");
export const pexelsKeyStatus = () => (process.env.PEXELS_API_KEY ? "ok" : "missing_key");

/** Narasi lewat ElevenLabs (model multibahasa, mendukung Bahasa Indonesia). Mengembalikan path MP3. */
export async function narrate(text: string, dir: string) {
  const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const model = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
  let res: Response;
  try {
    res = await fetch(`${ELEVENLABS()}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: model }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new BrainError("Tidak bisa terhubung ke ElevenLabs. Periksa internet PC ini.");
  }
  if (res.status === 401) throw new BrainError("API key ElevenLabs ditolak (401). Periksa ELEVENLABS_API_KEY.");
  if (res.status === 404) throw new BrainError(`Suara ElevenLabs "${voice}" tidak ditemukan. Periksa ELEVENLABS_VOICE_ID.`);
  if (res.status === 429) throw new BrainError("Kuota atau batas kecepatan ElevenLabs habis (429). Coba lagi nanti.");
  if (!res.ok) throw new BrainError(`ElevenLabs error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const path = join(dir, "voice.mp3");
  await writeFile(path, new Uint8Array(await res.arrayBuffer()));
  return path;
}

export type Clip = { path: string; credit: { provider: "pexels"; url: string; author: string; author_url: string } };

type PexelsVideo = {
  id: number;
  url: string;
  user: { name: string; url: string };
  video_files: { id: number; width: number; height: number; file_type: string; link: string }[];
};

/**
 * Cari klip potret di Pexels untuk satu adegan. `page` digeser saat revisi supaya footage berganti.
 * File diunduh ke cache dan dipakai ulang. Null bila tidak ada hasil (adegan memakai latar warna).
 */
export async function findClip(query: string, opts: { cacheDir: string; minHeight: number; locale: string; page: number; avoid: Set<number> }): Promise<Clip | null> {
  const url = new URL(`${PEXELS()}/v1/videos/search`);
  url.search = new URLSearchParams({ query, orientation: "portrait", per_page: "8", page: String(opts.page), locale: opts.locale }).toString();
  let res: Response;
  try {
    res = await fetch(url, { headers: { authorization: process.env.PEXELS_API_KEY ?? "" }, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new BrainError("Tidak bisa terhubung ke Pexels. Periksa internet PC ini.");
  }
  if (res.status === 401 || res.status === 403) throw new BrainError("API key Pexels ditolak. Periksa PEXELS_API_KEY.");
  if (res.status === 429) throw new BrainError("Batas permintaan Pexels habis (429). Coba lagi nanti.");
  if (!res.ok) throw new BrainError(`Pexels error ${res.status}.`);
  const data = (await res.json()) as { videos?: PexelsVideo[] };

  for (const v of data.videos ?? []) {
    if (opts.avoid.has(v.id)) continue;
    // File MP4 potret terkecil yang masih cukup tinggi: cepat diunduh, cukup tajam.
    const file = v.video_files
      .filter((f) => f.file_type === "video/mp4" && f.height >= f.width && f.height >= opts.minHeight)
      .sort((a, b) => a.height - b.height)[0];
    if (!file) continue;
    opts.avoid.add(v.id);
    mkdirSync(opts.cacheDir, { recursive: true });
    const path = join(opts.cacheDir, `pexels-${v.id}-${file.id}.mp4`);
    if (!existsSync(path)) await download(file.link, path);
    return { path, credit: { provider: "pexels", url: v.url, author: v.user.name, author_url: v.user.url } };
  }
  return null;
}

async function download(link: string, path: string) {
  const res = await fetch(link, { signal: AbortSignal.timeout(180_000) }).catch(() => null);
  if (!res?.ok || !res.body) throw new BrainError("Gagal mengunduh footage dari Pexels.");
  const tmp = `${path}.part`;
  await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(tmp));
  renameSync(tmp, path);
}
