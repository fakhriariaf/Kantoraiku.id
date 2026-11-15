import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { WORDS_PER_SECOND, countWords, type VideoOutput, type WorkPackage } from "@kantoraiku/shared";
import { BrainError, type Progress } from "../brains/types.ts";
import { elevenlabsKeyStatus, findClip, narrate, type Clip } from "./sources.ts";
import { generateImage, imagePrompt, ImageRejected, resolveVisual, type ResolvedVisual } from "./images.ts";

// Render video pendek 9:16 di PC dengan FFmpeg: narasi + footage per adegan + teks terbakar (subtitle).
// File video tetap di PC (KANTORAIKU_VIDEO_DIR); yang dikirim ke server hanya keterangan dan cover kecil.

const FFMPEG = (): string => process.env.FFMPEG_PATH || (createRequire(import.meta.url)("ffmpeg-static") as string);
const BACKGROUNDS = ["0x1f2a44", "0x2d3a5f", "0x3b2f4a", "0x24403a"];

export function videoRoot() {
  return process.env.KANTORAIKU_VIDEO_DIR || join(homedir(), "Videos", "Kantoraiku");
}

function size() {
  const m = /^(\d+)x(\d+)$/.exec(process.env.KANTORAIKU_VIDEO_SIZE ?? "");
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1080, h: 1920 };
}

export type Scene = { text: string; visual: string };

/** Adegan dari rencana visual; bila rencana tidak menutup naskah, naskah dipecah per kalimat. */
export function planScenes(c: NonNullable<WorkPackage["context"]["content"]>): Scene[] {
  const plan = c.visualPlan.map((p) => ({ text: p.scene.trim(), visual: p.visual.trim() })).filter((p) => p.text);
  const scriptWords = countWords(c.script);
  if (plan.length && countWords(plan.map((p) => p.text).join(" ")) >= scriptWords * 0.6) return plan;

  const sentences = c.script.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const scenes: Scene[] = [];
  let buf: string[] = [];
  for (const s of sentences) {
    buf.push(s);
    if (countWords(buf.join(" ")) >= 18) {
      scenes.push({ text: buf.join(" "), visual: "" });
      buf = [];
    }
  }
  if (buf.length) scenes.push({ text: buf.join(" "), visual: "" });
  const visuals = plan.map((p) => p.visual).filter(Boolean);
  return scenes.map((s, i) => ({ ...s, visual: visuals.length ? visuals[i % visuals.length] : c.title }));
}

/** Durasi tiap adegan sebanding jumlah katanya, total = panjang narasi. */
export function timeline(scenes: Scene[], total: number) {
  const words = scenes.map((s) => Math.max(1, countWords(s.text)));
  const sum = words.reduce((a, b) => a + b, 0);
  let t = 0;
  return scenes.map((s, i) => {
    const d = Math.max(1.5, (words[i] / sum) * total);
    const start = t;
    t += d;
    return { ...s, start, end: t };
  });
}

const ts = (sec: number) => {
  const cs = Math.round(sec * 100);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};

/** Subtitle ASS: teks per potongan maksimal 7 kata, waktu dibagi rata menurut jumlah kata. */
export function captions(timed: { text: string; start: number; end: number }[], w: number, h: number) {
  const esc = (t: string) => t.replace(/\\/g, "/").replace(/[{}]/g, "").replace(/\s+/g, " ");
  const lines: string[] = [];
  for (const sc of timed) {
    const words = sc.text.split(/\s+/).filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < words.length; i += 7) chunks.push(words.slice(i, i + 7));
    const per = (sc.end - sc.start) / Math.max(1, words.length);
    let t = sc.start;
    for (const ch of chunks) {
      const end = t + per * ch.length;
      lines.push(`Dialogue: 0,${ts(t)},${ts(end)},Default,,0,0,0,,${esc(ch.join(" "))}`);
      t = end;
    }
  }
  const fs = Math.round(h * 0.045);
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,Arial,${fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(h * 0.004))},1,2,${Math.round(w * 0.08)},${Math.round(w * 0.08)},${Math.round(h * 0.18)},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
    "",
  ].join("\n");
}

/** Jalankan FFmpeg di `cwd`; `onTime` menerima detik yang sudah dirender. */
function ffmpeg(args: string[], cwd: string, onTime?: (sec: number) => Promise<void>) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn(FFMPEG(), ["-hide_banner", "-nostdin", ...args], { cwd, windowsHide: true });
    let err = "";
    let out = "";
    let failed: unknown = null;
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    p.stdout.on("data", (d) => {
      out += d;
      const lines = out.split("\n");
      out = lines.pop() ?? "";
      for (const l of lines) {
        const m = /^out_time_us=(\d+)/.exec(l);
        if (m && onTime) onTime(Number(m[1]) / 1e6).catch((e) => {
          failed = e;
          p.kill();
        });
      }
    });
    p.on("error", (e) => reject(new BrainError(`FFmpeg tidak bisa dijalankan: ${e.message}`)));
    p.on("close", (code) => {
      if (failed) return reject(failed);
      if (code === 0) return resolve(err);
      reject(new BrainError(`FFmpeg gagal (kode ${code}): ${err.split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 400)}`));
    });
  });
}

async function audioSeconds(file: string, cwd: string) {
  // `ffmpeg -i` tanpa output keluar dengan kode 1; durasinya ada di stderr.
  const log = await ffmpeg(["-i", file, "-f", "null", "-"], cwd);
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(log);
  if (!m) throw new BrainError("Durasi narasi tidak terbaca.");
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const fileSlug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "video";

export type RenderResult = { output: VideoOutput; cover: Uint8Array | null };

type Media = ({ kind: "clip" } & Clip) | { kind: "image"; path: string } | null;

/**
 * Gerakan kamera pelan untuk gambar diam (efek Ken Burns): bergantian zoom masuk, zoom keluar, dan geser.
 * Gambar dibesarkan 2x dulu supaya gerakan halus (zoompan membulatkan posisi ke piksel).
 */
export function kenBurns(i: number, seconds: number, w: number, h: number) {
  const F = Math.ceil(seconds * 30) + 1;
  const center = { x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  const moves = [
    { z: `1+0.12*on/${F}`, ...center },
    { z: `1.12-0.12*on/${F}`, ...center },
    { z: "1.1", x: `(iw-iw/zoom)*on/${F}`, y: center.y },
  ];
  const m = moves[i % moves.length];
  return (
    `scale=${2 * w}:${2 * h}:force_original_aspect_ratio=increase,crop=${2 * w}:${2 * h},` +
    `zoompan=z='${m.z}':x='${m.x}':y='${m.y}':d=${F}:s=${w}x${h}:fps=30`
  );
}

export async function renderVideo(p: WorkPackage, progress: Progress, opts: { officeSlug: string }): Promise<RenderResult> {
  const c = p.context.content;
  if (!c) throw new BrainError("Tidak ada naskah yang siap dijadikan video. Setujui naskah dulu, atau jalankan tugas ini setelah tugas naskah.");
  if (countWords(c.script) < 5) throw new BrainError("Naskah terlalu pendek untuk dijadikan video.");

  const { w, h } = size();
  const root = videoRoot();
  const work = mkdtempSync(join(tmpdir(), "kantoraiku-video-"));
  try {
    const scenes = planScenes(c);
    const narration = scenes.map((s) => s.text).join(" ");

    // 1. Suara
    let voice: VideoOutput["voice"] = "simulation";
    let total = countWords(narration) / WORDS_PER_SECOND;
    if (elevenlabsKeyStatus() === "ok") {
      await progress(10, "Membuat suara narasi (ElevenLabs)");
      await narrate(narration, work);
      total = await audioSeconds("voice.mp3", work);
      voice = "elevenlabs";
    } else {
      await progress(10, "Suara simulasi: ELEVENLABS_API_KEY belum diisi");
    }
    total = Math.max(3, total + 0.5);
    const timed = timeline(scenes, total);
    total = timed[timed.length - 1].end;

    // 2. Visual per adegan: gambar AI (digerakkan), footage stok, atau latar polos
    const visual: ResolvedVisual = resolveVisual(p.channel?.visual ?? "auto");
    const media: Media[] = [];
    const cacheDir = join(root, ".cache");
    let aiImages = 0;
    if (visual === "ai_fal" || visual === "ai_openai") {
      const name = visual === "ai_fal" ? "fal" : "OpenAI";
      const style = { title: c.title, style: p.channel?.visualStyle ?? "", niche: p.channel?.niche ?? "" };
      for (const [i, sc] of timed.entries()) {
        await progress(15 + Math.round((i / timed.length) * 20), `Membuat gambar AI adegan ${i + 1}/${timed.length} (${name})`);
        const seed = 1000 * (c.revision + 1) + i;
        let path: string | null = null;
        for (const prompt of [imagePrompt(sc, style), imagePrompt({ visual: c.title, text: "" }, style)]) {
          try {
            path = await generateImage(visual, prompt, { cacheDir, seed });
            break;
          } catch (e) {
            if (!(e instanceof ImageRejected)) throw e;
            await progress(15 + Math.round((i / timed.length) * 20), `Gambar adegan ${i + 1} ditolak ${name}, mencoba prompt lain`);
          }
        }
        if (path) aiImages++;
        media.push(path ? { kind: "image", path } : null);
      }
    } else if (visual === "stock") {
      const avoid = new Set<number>();
      for (const [i, sc] of timed.entries()) {
        await progress(15 + Math.round((i / timed.length) * 20), `Mencari footage adegan ${i + 1}/${timed.length}`);
        const query = (sc.visual || c.title).split(/\s+/).slice(0, 8).join(" ");
        const common = { cacheDir, minHeight: Math.min(h, 960) / 2, locale: p.channel?.language === "en" ? "en-US" : "id-ID", page: 1 + c.revision, avoid };
        const clip = (await findClip(query, common)) ?? (await findClip(c.title, common));
        media.push(clip ? { kind: "clip", ...clip } : null);
      }
    } else {
      await progress(15, "Latar polos (belum ada kunci gambar AI atau footage)");
      timed.forEach(() => media.push(null));
    }

    // 3. Render
    writeFileSync(join(work, "captions.ass"), captions(timed, w, h));
    const args: string[] = [];
    timed.forEach((sc, i) => {
      const d = (sc.end - sc.start).toFixed(3);
      const m = media[i];
      if (m?.kind === "clip") args.push("-stream_loop", "-1", "-t", d, "-i", m.path);
      else if (m?.kind === "image") args.push("-i", m.path);
      else args.push("-f", "lavfi", "-t", d, "-i", `color=c=${BACKGROUNDS[i % BACKGROUNDS.length]}:s=${w}x${h}:r=30`);
    });
    if (voice === "elevenlabs") args.push("-i", "voice.mp3");
    else args.push("-f", "lavfi", "-t", total.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
    const n = timed.length;
    const parts = timed.map((sc, i) => {
      const d = sc.end - sc.start;
      const tail = `setsar=1,fps=30,format=yuv420p,trim=duration=${d.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`;
      if (media[i]?.kind === "image") return `[${i}:v]${kenBurns(i, d, w, h)},${tail}`;
      return `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},${tail}`;
    });
    const filter = `${parts.join(";")};${timed.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0[vc];[vc]subtitles=captions.ass[vout]`;
    args.push(
      "-filter_complex", filter,
      "-map", "[vout]", "-map", `${n}:a`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-t", total.toFixed(3), "-movflags", "+faststart",
      "-progress", "pipe:1", "-nostats", "-y", "out.mp4",
    );
    await progress(40, "Merender video");
    let last = 40;
    await ffmpeg(args, work, async (sec) => {
      const pct = 40 + Math.min(45, Math.floor((sec / total) * 45));
      if (pct >= last + 5) {
        last = pct;
        await progress(pct, `Merender video ${Math.round((sec / total) * 100)}%`);
      }
    });

    // 4. Cover kecil
    await progress(90, "Membuat cover");
    let cover: Uint8Array | null = null;
    for (const q of ["5", "12"]) {
      await ffmpeg(["-ss", Math.min(1, total / 2).toFixed(2), "-i", "out.mp4", "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", q, "-y", "cover.jpg"], work);
      const buf = readFileSync(join(work, "cover.jpg"));
      if (buf.length <= 200 * 1024) {
        cover = new Uint8Array(buf);
        break;
      }
    }

    // 5. Simpan di PC
    const dir = join(root, opts.officeSlug);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().slice(0, 10)}-${fileSlug(c.title)}-${c.id.slice(0, 8)}-r${c.revision}.mp4`);
    writeFileSync(file, readFileSync(join(work, "out.mp4")));

    return {
      output: {
        local_ref: file,
        duration_s: Math.max(1, Math.round(total)),
        width: w,
        height: h,
        voice,
        footage: media.flatMap((m) => (m?.kind === "clip" ? [m.credit] : [])).filter((cr, i, all) => all.findIndex((x) => x.url === cr.url) === i),
        visual,
        ai_images: aiImages,
      },
      cover,
    };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
