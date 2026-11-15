import { parseArgs } from "node:util";
import { client } from "./api.ts";
import { loadConfig, VERSION, configPath } from "./config.ts";
import { pairPc } from "./pair.ts";
import { aiStatus, work } from "./worker.ts";
import { DEFAULT_OPENAI_MODEL } from "./brains/openai.ts";
import { DEFAULT_CLAUDE_MODEL } from "./brains/claude.ts";
import { elevenlabsKeyStatus, pexelsKeyStatus } from "./video/sources.ts";
import { videoRoot } from "./video/render.ts";

const HELP = `Konektor Kantoraiku ${VERSION}

  pair <KODE> [--server URL] [--name NAMA]   Sambungkan PC ini ke kantor (kode dari menu Perangkat)
  start [--once]                             Jalankan agent; --once berhenti saat antrean kosong
  status                                     Tampilkan kantor, server, dan status otak AI
`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { server: { type: "string" }, name: { type: "string" }, once: { type: "boolean" } },
  });
  const [cmd, arg] = positionals;

  if (cmd === "pair") {
    if (!arg) throw new Error("Kode setup wajib diisi: pair <KODE>");
    const server = values.server ?? process.env.KANTORAIKU_SERVER ?? "http://localhost:3000";
    const { config: r, path: p } = await pairPc({ server, code: arg, name: values.name });
    console.log(`Tersambung ke kantor "${r.officeName}" (${r.officeSlug}).\nKonfigurasi disimpan di ${p}\nJalankan: pnpm --filter @kantoraiku/runner start`);
    return;
  }

  const cfg = loadConfig();
  if (!cfg) throw new Error(`Belum dipasangkan. Jalankan "pair <KODE>" dulu. (${configPath()})`);

  if (cmd === "status") {
    console.log({ kantor: `${cfg.officeName} (${cfg.officeSlug})`, server: cfg.server, perangkat: cfg.deviceId, otak: aiStatus(), modelOpenAI: DEFAULT_OPENAI_MODEL, modelClaude: DEFAULT_CLAUDE_MODEL, video: { folder: videoRoot(), elevenlabs: elevenlabsKeyStatus(), pexels: pexelsKeyStatus() } });
    return;
  }
  if (cmd === "start") {
    console.log(`Konektor ${VERSION} untuk "${cfg.officeName}" di ${cfg.server}. Otak AI:`, aiStatus());
    const stop = new AbortController();
    process.on("SIGINT", () => {
      if (stop.signal.aborted) process.exit(130);
      stop.abort();
      console.log("Berhenti setelah tugas yang sedang jalan selesai… (Ctrl+C lagi untuk paksa)");
    });
    const result = await work(client(cfg), { once: values.once, officeSlug: cfg.officeSlug, privateKey: cfg.privateKey, signal: stop.signal });
    if (result === "revoked") {
      console.log("Perangkat ini sudah dicabut dari kantor. Pasangkan ulang dengan kode setup baru.");
      process.exit(1);
    }
    return;
  }
  console.log(HELP);
}

main().catch((e) => {
  console.error(`Gagal: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
