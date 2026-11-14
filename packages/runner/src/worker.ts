import { outputSchemaFor, type WorkPackage } from "@kantoraiku/shared";
import { z } from "zod";
import { HttpError, type Api } from "./api.ts";
import { VERSION } from "./config.ts";
import { simulation } from "./brains/simulation.ts";
import { openai, openaiKeyStatus } from "./brains/openai.ts";
import { claude, claudeKeyStatus } from "./brains/claude.ts";
import { BrainError, type Brain } from "./brains/types.ts";
import { renderVideo } from "./video/render.ts";

const BRAINS: Record<string, Brain | undefined> = { simulation, openai, claude };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toLocaleTimeString("id-ID"), ...a);

export function aiStatus() {
  return {
    simulation: "ok" as const,
    openai: openaiKeyStatus() as "ok" | "missing_key",
    claude: claudeKeyStatus() as "ok" | "missing_key",
  };
}

async function runOne(api: Api, p: WorkPackage, officeSlug: string) {
  log(`▶ ${p.agent.name}: "${p.task.name}" (${p.run.kind}, otak ${p.agent.brain})`);
  const progress = async (pct: number, message: string) => {
    log(`  ${pct}% ${message}`);
    const r = await api.progress(p.run.id, { pct, message }).catch(() => ({ cancel: false }));
    if (r.cancel) throw new BrainError("Run dibatalkan dari dashboard.");
  };

  try {
    await progress(5, "Mulai");
    if (p.run.kind === "video") {
      // Video tidak memakai otak AI: dirender di PC dengan FFmpeg dari naskah yang sudah disetujui.
      const r = await renderVideo(p, progress, { officeSlug });
      if (r.cover && p.context.content) {
        await api.uploadCover(p.context.content.id, r.cover).catch((e) => log("  cover gagal diunggah:", (e as Error).message));
      }
      await api.complete(p.run.id, { status: "succeeded", output: r.output });
      log(`✔ video tersimpan di PC: ${r.output.local_ref}`);
      return;
    }
    const brain = BRAINS[p.agent.brain];
    if (!brain) throw new BrainError(`Otak "${p.agent.brain}" belum tersedia di konektor ini.`);
    if (!(p.run.kind in outputSchemaFor)) throw new BrainError(`Jenis tugas "${p.run.kind}" belum didukung (fase berikutnya).`);
    const res = await brain(p, progress);
    const schema = outputSchemaFor[p.run.kind as keyof typeof outputSchemaFor];
    const checked = schema.safeParse(res.output);
    if (!checked.success) throw new BrainError(`Hasil tidak sesuai format: ${z.prettifyError(checked.error).slice(0, 300)}`);
    await api.complete(p.run.id, {
      status: "succeeded",
      output: checked.data,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      costUsdMicros: res.costUsdMicros,
    });
    log(`✔ selesai (${res.inputTokens + res.outputTokens} token)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`✖ gagal: ${msg}`);
    await api.complete(p.run.id, { status: "failed", error: msg }).catch((err) => log("  gagal melapor:", err.message));
  }
}

/** Loop utama: heartbeat tiap 30 dtk, ambil kerja tiap 5 dtk saat menganggur. */
export async function work(api: Api, opts: { once?: boolean; officeSlug: string }) {
  let stopping = false;
  let active: string[] = [];
  process.on("SIGINT", () => {
    if (stopping) process.exit(130);
    stopping = true;
    log("Berhenti setelah tugas yang sedang jalan selesai… (Ctrl+C lagi untuk paksa)");
  });

  const beat = async () => {
    try {
      return await api.heartbeat({ version: VERSION, aiStatus: aiStatus(), activeRunIds: active });
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        log("Perangkat ini sudah dicabut dari kantor. Pasangkan ulang dengan kode setup baru.");
        process.exit(1);
      }
      log("Heartbeat gagal:", (e as Error).message);
      return { hasWork: false };
    }
  };
  await beat();
  const timer = setInterval(beat, 30_000);

  try {
    while (!stopping) {
      let pkg: WorkPackage | null = null;
      try {
        pkg = await api.claim();
      } catch (e) {
        log("Gagal mengambil tugas:", (e as Error).message);
        await sleep(10_000);
        continue;
      }
      if (!pkg) {
        if (opts.once) break;
        await sleep(5_000);
        continue;
      }
      active = [pkg.run.id];
      await runOne(api, pkg, opts.officeSlug);
      active = [];
    }
  } finally {
    clearInterval(timer);
  }
}
