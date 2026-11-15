// Uji pipeline video: render sungguhan dengan FFmpeg (ukuran kecil supaya cepat).
// Pexels dan ElevenLabs diganti server palsu lokal yang menyajikan klip dan MP3 buatan FFmpeg sendiri.
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VideoOutput, type WorkPackage } from "@kantoraiku/shared";
import { captions, planScenes, renderVideo, timeline } from "../src/video/render.ts";
import { BrainError } from "../src/brains/types.ts";

const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const dir = mkdtempSync(join(tmpdir(), "kantoraiku-video-test-"));
const clip = join(dir, "clip.mp4");
const voice = join(dir, "voice.mp3");
const image = join(dir, "image.jpg");
const bodies: Record<string, unknown>[] = [];
let server: Server;
let base = "";
const hits: string[] = [];

const durationOf = (file: string) => {
  let log = "";
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (e) {
    log = String((e as { stderr: Buffer }).stderr);
  }
  const m = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(log)!;
  return Number(m[2]) * 60 + Number(m[3]);
};

before(async () => {
  // Klip potret 2 detik dan narasi 6 detik, dibuat lokal.
  execFileSync(ffmpeg, ["-hide_banner", "-f", "lavfi", "-i", "testsrc=s=360x640:r=30:d=2", "-pix_fmt", "yuv420p", "-y", clip], { stdio: "ignore" });
  execFileSync(ffmpeg, ["-hide_banner", "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-y", voice], { stdio: "ignore" });
  execFileSync(ffmpeg, ["-hide_banner", "-f", "lavfi", "-i", "testsrc=s=384x672:d=1", "-frames:v", "1", "-y", image], { stdio: "ignore" });
  server = createServer(async (req, res) => {
    hits.push(`${req.method} ${req.url?.split("?")[0]} ${req.headers["xi-api-key"] ?? req.headers.authorization ?? ""}`);
    if (req.url?.startsWith("/tolak")) return void res.writeHead(401).end();
    if (req.url === "/fal-ai/flux/schnell" || req.url === "/v1/images/generations") {
      let raw = "";
      for await (const ch of req) raw += ch;
      const body = JSON.parse(raw) as Record<string, unknown>;
      bodies.push(body);
      // Prompt berisi TOLAK: ditolak filter keamanan (422), adegan mencoba prompt lain.
      if (String(body.prompt).includes("TOLAK")) return void res.writeHead(422, { "content-type": "application/json" }).end('{"detail":"tidak aman"}');
      res.writeHead(200, { "content-type": "application/json" });
      if (req.url === "/v1/images/generations") return res.end(JSON.stringify({ data: [{ b64_json: readFileSync(image).toString("base64") }] }));
      return res.end(JSON.stringify({ images: [{ url: `${base}/file/image.jpg`, content_type: "image/jpeg" }] }));
    }
    if (req.url === "/file/image.jpg") {
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(readFileSync(image));
    }
    if (req.url?.startsWith("/v1/text-to-speech/")) {
      for await (const _ of req);
      res.writeHead(200, { "content-type": "audio/mpeg" });
      return res.end(readFileSync(voice));
    }
    if (req.url?.startsWith("/v1/videos/search")) {
      const q = new URL(req.url, "http://x").searchParams;
      const id = q.get("query")!.length; // id berbeda per kueri
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(
        JSON.stringify({
          videos: [
            {
              id,
              url: `https://www.pexels.com/video/${id}/`,
              user: { name: "Videografer Uji", url: "https://www.pexels.com/@uji" },
              video_files: [
                { id: 1, width: 1920, height: 1080, file_type: "video/mp4", link: `${base}/file/landscape.mp4` },
                { id: 2, width: 360, height: 640, file_type: "video/mp4", link: `${base}/file/clip.mp4` },
              ],
            },
          ],
        }),
      );
    }
    if (req.url === "/file/clip.mp4") {
      res.writeHead(200, { "content-type": "video/mp4" });
      return res.end(readFileSync(clip));
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  hits.length = 0;
  process.env.KANTORAIKU_VIDEO_DIR = join(dir, "out");
  process.env.KANTORAIKU_VIDEO_SIZE = "180x320";
  process.env.ELEVENLABS_BASE_URL = base;
  process.env.PEXELS_BASE_URL = base;
  process.env.FAL_BASE_URL = base;
  process.env.OPENAI_IMAGE_BASE_URL = base;
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.PEXELS_API_KEY;
  delete process.env.FAL_KEY;
  delete process.env.OPENAI_API_KEY;
  bodies.length = 0;
});

const ID = "00000000-0000-4000-8000-000000000002";
const pkg = (content?: WorkPackage["context"]["content"], visual: NonNullable<WorkPackage["channel"]>["visual"] = "auto", visualStyle = ""): WorkPackage => ({
  run: { id: ID, kind: "video", triggerSource: "chain" },
  agent: { id: ID, name: "Raka", title: "Editor video", jobDescription: "", brain: "simulation", model: null },
  task: { id: ID, name: "Video", instructions: "" },
  skills: [],
  channel: { id: ID, name: "Resep 10 menit", niche: "masak cepat", language: "id", visual, visualStyle },
  context: { content },
});
const content = {
  id: ID,
  title: "Mi goreng lima menit",
  script: "Lapar tapi malas masak? Ini caranya. Rebus mi dua menit saja. Tumis bawang putih sampai harum, lalu campur dengan bumbu. Selesai, tinggal makan!",
  visualPlan: [
    { scene: "Lapar tapi malas masak? Ini caranya.", visual: "orang lapar di dapur" },
    { scene: "Rebus mi dua menit saja.", visual: "mi direbus" },
    { scene: "Tumis bawang putih sampai harum, lalu campur dengan bumbu. Selesai, tinggal makan!", visual: "wajan bawang putih" },
  ],
  revision: 0,
  note: null,
};
const progress: string[] = [];
const onProgress = async (_: number, m: string) => {
  progress.push(m);
};

test("adegan dan subtitle: rencana visual dipakai, waktu sebanding jumlah kata", () => {
  const scenes = planScenes(content);
  assert.equal(scenes.length, 3);
  const timed = timeline(scenes, 12);
  assert.ok(Math.abs(timed[2].end - 12) < 0.01);
  assert.ok(timed[2].end - timed[2].start > timed[1].end - timed[1].start);
  const ass = captions(timed, 1080, 1920);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /Dialogue: 0,0:00:00\.00,/);
  // Rencana visual yang tidak menutup naskah: naskah dipecah per kalimat.
  const fallback = planScenes({ ...content, visualPlan: [{ scene: "Lapar?", visual: "dapur" }] });
  assert.ok(fallback.length >= 2);
  assert.equal(fallback[0].visual, "dapur");
});

test("tanpa kunci: suara simulasi + latar warna, video dan cover tersimpan di PC", async () => {
  const r = await renderVideo(pkg(content), onProgress, { officeSlug: "studio-uji" });
  const out = VideoOutput.parse(r.output);
  assert.equal(out.voice, "simulation");
  assert.deepEqual(out.footage, []);
  assert.equal(out.visual, "plain");
  assert.ok(existsSync(out.local_ref));
  assert.ok(out.local_ref.includes(join("out", "studio-uji")));
  assert.equal(out.width, 180);
  // 23 kata / 2,5 kata per detik + jeda = ~10 detik
  assert.ok(Math.abs(durationOf(out.local_ref) - out.duration_s) <= 1.5, "durasi file sesuai laporan");
  assert.ok(r.cover && r.cover[0] === 0xff && r.cover[1] === 0xd8 && r.cover.length < 200 * 1024);
  assert.equal(hits.length, 0, "tidak memanggil layanan luar tanpa kunci");
  assert.ok(progress.some((m) => m.startsWith("Merender video")));
});

test("dengan kunci: narasi ElevenLabs menentukan durasi, footage Pexels potret + kredit", async () => {
  process.env.ELEVENLABS_API_KEY = "uji-eleven";
  process.env.PEXELS_API_KEY = "uji-pexels";
  const r = await renderVideo(pkg({ ...content, revision: 1 }), onProgress, { officeSlug: "studio-uji" });
  const out = VideoOutput.parse(r.output);
  assert.equal(out.voice, "elevenlabs");
  assert.ok(Math.abs(out.duration_s - 7) <= 1, `durasi ikut narasi (6 dtk + jeda), dapat ${out.duration_s}`);
  assert.ok(out.footage.length >= 1);
  assert.equal(out.footage[0].author, "Videografer Uji");
  assert.equal(out.visual, "stock");
  assert.ok(hits.some((h) => h.startsWith("POST /v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb uji-eleven")));
  assert.ok(hits.some((h) => h.startsWith("GET /v1/videos/search uji-pexels")));
  assert.ok(!hits.some((h) => h.includes("landscape")), "file lanskap tidak diunduh");
});

test("tanpa naskah: pesan yang jelas", async () => {
  await assert.rejects(renderVideo(pkg(undefined), onProgress, { officeSlug: "x" }), (e: unknown) => e instanceof BrainError && /Setujui naskah dulu/.test(e.message));
});

test("ElevenLabs menolak kunci: pesan Indonesia", async () => {
  process.env.ELEVENLABS_API_KEY = "salah";
  process.env.ELEVENLABS_BASE_URL = `${base}/tolak`;
  await assert.rejects(renderVideo(pkg(content), onProgress, { officeSlug: "x" }), (e: unknown) => e instanceof BrainError && /ElevenLabs ditolak \(401\)/.test(e.message));
});

test("gambar AI fal (auto): satu gambar per adegan digerakkan, render ulang memakai cache", async () => {
  process.env.FAL_KEY = "uji-fal";
  process.env.PEXELS_API_KEY = "uji-pexels"; // fal didahulukan dari stok
  const r = await renderVideo(pkg(content, "auto", "ilustrasi flat pastel"), onProgress, { officeSlug: "studio-uji" });
  const out = VideoOutput.parse(r.output);
  assert.equal(out.visual, "ai_fal");
  assert.equal(out.ai_images, 3);
  assert.deepEqual(out.footage, []);
  assert.equal(hits.filter((h) => h === "POST /fal-ai/flux/schnell Key uji-fal").length, 3);
  assert.ok(!hits.some((h) => h.startsWith("GET /v1/videos/search")), "stok tidak dicari");
  const b = bodies[0] as { prompt: string; image_size: { width: number; height: number }; seed: number };
  assert.match(b.prompt, /ilustrasi flat pastel/);
  assert.match(b.prompt, /orang lapar di dapur/);
  assert.match(b.prompt, /No text/);
  assert.deepEqual(b.image_size, { width: 768, height: 1344 });
  assert.ok(Math.abs(durationOf(out.local_ref) - out.duration_s) <= 1.5);
  assert.ok(progress.some((m) => m.startsWith("Membuat gambar AI adegan 1/3 (fal)")));

  hits.length = 0;
  await renderVideo(pkg(content, "auto", "ilustrasi flat pastel"), onProgress, { officeSlug: "studio-uji" });
  assert.equal(hits.filter((h) => h.startsWith("POST /fal-ai")).length, 0, "gambar yang sama tidak dibayar dua kali");
  // Revisi video: seed lain, gambar baru.
  await renderVideo(pkg({ ...content, revision: 1 }, "auto", "ilustrasi flat pastel"), onProgress, { officeSlug: "studio-uji" });
  assert.equal(hits.filter((h) => h.startsWith("POST /fal-ai")).length, 3);
});

test("gambar AI OpenAI hanya bila dipilih: ukuran potret, model gpt-image-2", async () => {
  process.env.OPENAI_API_KEY = "uji-openai";
  // auto tidak memakai kunci OpenAI (dipakai otak agent): latar polos.
  const auto = VideoOutput.parse((await renderVideo(pkg(content), onProgress, { officeSlug: "studio-uji" })).output);
  assert.equal(auto.visual, "plain");
  assert.equal(bodies.length, 0);

  const r = await renderVideo(pkg(content, "ai_openai"), onProgress, { officeSlug: "studio-uji" });
  const out = VideoOutput.parse(r.output);
  assert.equal(out.visual, "ai_openai");
  assert.equal(out.ai_images, 3);
  const b = bodies[0] as { model: string; size: string; output_format: string };
  assert.equal(b.model, "gpt-image-2");
  assert.equal(b.size, "1024x1536");
  assert.equal(b.output_format, "jpeg");
  assert.ok(hits.some((h) => h === "POST /v1/images/generations Bearer uji-openai"));
});

test("pilihan visual tanpa kunci: pesan jelas; gambar ditolak: prompt cadangan lalu latar polos", async () => {
  await assert.rejects(renderVideo(pkg(content, "ai_fal"), onProgress, { officeSlug: "x" }), (e: unknown) => e instanceof BrainError && /kunci fal belum diisi/.test(e.message));
  await assert.rejects(renderVideo(pkg(content, "stock"), onProgress, { officeSlug: "x" }), (e: unknown) => e instanceof BrainError && /kunci Pexels belum diisi/.test(e.message));

  process.env.FAL_KEY = "uji-fal";
  // Adegan 1 ditolak; prompt cadangan (dari judul) diterima.
  const plan = content.visualPlan.map((v, i) => (i === 0 ? { ...v, visual: "adegan TOLAK" } : v));
  const out = VideoOutput.parse((await renderVideo(pkg({ ...content, visualPlan: plan }, "ai_fal"), onProgress, { officeSlug: "x" })).output);
  assert.equal(out.ai_images, 3);
  assert.ok(progress.some((m) => /ditolak fal, mencoba prompt lain/.test(m)));

  // Semua prompt ditolak (judul ikut di tiap prompt): semua adegan latar polos, video tetap jadi.
  const all = VideoOutput.parse((await renderVideo(pkg({ ...content, title: "Judul TOLAK", visualPlan: plan }, "ai_fal"), onProgress, { officeSlug: "x" })).output);
  assert.equal(all.ai_images, 0);
  assert.ok(existsSync(all.local_ref));
});
