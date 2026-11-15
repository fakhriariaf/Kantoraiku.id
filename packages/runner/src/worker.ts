import { outputSchemaFor, type WorkPackage } from "@kantoraiku/shared";
import { z } from "zod";
import { HttpError, type Api } from "./api.ts";
import { VERSION } from "./config.ts";
import { simulation } from "./brains/simulation.ts";
import { openai, openaiKeyStatus } from "./brains/openai.ts";
import { claude, claudeKeyStatus } from "./brains/claude.ts";
import { BrainError, type Brain } from "./brains/types.ts";
import { renderVideo } from "./video/render.ts";
import { onBattery } from "./power.ts";
import { applySecrets } from "./secrets.ts";

const BRAINS: Record<string, Brain | undefined> = { simulation, openai, claude };
const consoleLog = (...a: unknown[]) => console.log(new Date().toLocaleTimeString("id-ID"), ...a);

/** Tidur yang bisa dipotong signal (berhenti/jeda dari aplikasi). */
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((r) => {
    if (signal?.aborted) return r();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      r();
    }
    signal?.addEventListener("abort", done, { once: true });
  });

/** Kejadian untuk tampilan aplikasi konektor (tray). CLI cukup memakai log. */
export type WorkerEvent =
  | { type: "online"; ok: boolean; error?: string }
  | { type: "run_start"; runId: string; agent: string; task: string; kind: string }
  | { type: "progress"; runId: string; pct: number; message: string }
  | { type: "run_end"; runId: string; ok: boolean; message: string }
  | { type: "secrets"; applied: number; total: number };

export type WorkOptions = {
  officeSlug: string;
  privateKey: string;
  /** Berhenti saat antrean kosong (CLI --once). */
  once?: boolean;
  /** Abort: berhenti mengambil tugas baru; tugas yang sedang jalan diselesaikan dulu. */
  signal?: AbortSignal;
  /** Versi yang dilaporkan ke dashboard (aplikasi Windows memakai versinya sendiri). */
  version?: string;
  log?: (...a: unknown[]) => void;
  onEvent?: (e: WorkerEvent) => void;
};

/** "revoked": perangkat dicabut dari dashboard; pasangkan ulang dengan kode baru. */
export type WorkResult = "stopped" | "drained" | "revoked";

export function aiStatus() {
  return {
    simulation: "ok" as const,
    openai: openaiKeyStatus() as "ok" | "missing_key",
    claude: claudeKeyStatus() as "ok" | "missing_key",
  };
}

async function runOne(api: Api, p: WorkPackage, officeSlug: string, log: (...a: unknown[]) => void, emit: (e: WorkerEvent) => void) {
  emit({ type: "run_start", runId: p.run.id, agent: p.agent.name, task: p.task.name, kind: p.run.kind });
  log(`▶ ${p.agent.name}: "${p.task.name}" (${p.run.kind}, otak ${p.agent.brain})`);
  const progress = async (pct: number, message: string) => {
    log(`  ${pct}% ${message}`);
    emit({ type: "progress", runId: p.run.id, pct, message });
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
      emit({ type: "run_end", runId: p.run.id, ok: true, message: `Video tersimpan di ${r.output.local_ref}` });
      return;
    }
    if (p.run.kind === "cs_reply" && !p.context.cs) throw new BrainError("Percakapan WhatsApp untuk tugas ini tidak ditemukan.");
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
    emit({ type: "run_end", runId: p.run.id, ok: true, message: "Selesai" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`✖ gagal: ${msg}`);
    emit({ type: "run_end", runId: p.run.id, ok: false, message: msg });
    await api.complete(p.run.id, { status: "failed", error: msg }).catch((err) => log("  gagal melapor:", err.message));
  }
}

/** Loop utama: heartbeat tiap 30 dtk, ambil kerja tiap 5 dtk saat menganggur. */
export async function work(api: Api, opts: WorkOptions): Promise<WorkResult> {
  const log = opts.log ?? consoleLog;
  const emit = opts.onEvent ?? (() => {});
  const version = opts.version ?? VERSION;
  const signal = opts.signal;
  let revoked = false;
  let active: string[] = [];

  let secretsSeen = "";
  const refreshSecrets = async () => {
    const { secrets } = await api.secrets();
    const n = await applySecrets(secrets, opts.privateKey, log);
    if (secrets.length) log(`Kunci dari dashboard terpasang: ${n} dari ${secrets.length}`);
    emit({ type: "secrets", applied: n, total: secrets.length });
  };
  const beat = async (): Promise<{ hasWork: boolean; secrets?: string }> => {
    try {
      let r = await api.heartbeat({ version, aiStatus: aiStatus(), activeRunIds: active, onBattery: await onBattery() });
      if (r.secrets !== undefined && r.secrets !== secretsSeen) {
        // Kunci di dashboard berubah: ambil ulang, lalu laporkan status kunci yang baru.
        secretsSeen = r.secrets;
        await refreshSecrets();
        r = await api.heartbeat({ version, aiStatus: aiStatus(), activeRunIds: active, onBattery: await onBattery() });
      }
      emit({ type: "online", ok: true });
      return r;
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        revoked = true;
        return { hasWork: false };
      }
      log("Heartbeat gagal:", (e as Error).message);
      emit({ type: "online", ok: false, error: (e as Error).message });
      return { hasWork: false };
    }
  };
  await beat();
  const timer = setInterval(beat, 30_000);

  try {
    while (!revoked && !signal?.aborted) {
      let pkg: WorkPackage | null = null;
      try {
        pkg = await api.claim();
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) {
          revoked = true;
          break;
        }
        log("Gagal mengambil tugas:", (e as Error).message);
        await sleep(10_000, signal);
        continue;
      }
      if (!pkg) {
        if (opts.once) return "drained";
        await sleep(5_000, signal);
        continue;
      }
      active = [pkg.run.id];
      await runOne(api, pkg, opts.officeSlug, log, emit);
      active = [];
    }
  } finally {
    clearInterval(timer);
  }
  return revoked ? "revoked" : "stopped";
}
