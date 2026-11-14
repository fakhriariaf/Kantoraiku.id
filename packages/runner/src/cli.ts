import { generateKeyPairSync } from "node:crypto";
import { hostname, platform } from "node:os";
import { parseArgs } from "node:util";
import { client, pairDevice } from "./api.ts";
import { loadConfig, saveConfig, VERSION, configPath } from "./config.ts";
import { aiStatus, work } from "./worker.ts";
import { DEFAULT_OPENAI_MODEL } from "./brains/openai.ts";
import { DEFAULT_CLAUDE_MODEL } from "./brains/claude.ts";

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
    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const pubRaw = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
    const r = await pairDevice(server, {
      setupCode: arg,
      kind: platform() === "darwin" ? "pc_mac" : "pc_windows",
      name: values.name ?? `PC ${hostname()}`.slice(0, 60),
      publicKey: pubRaw,
      version: VERSION,
    });
    const p = saveConfig({
      server,
      deviceId: r.deviceId,
      deviceToken: r.deviceToken,
      officeSlug: r.officeSlug,
      officeName: r.officeName,
      publicKey: pubRaw,
      privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    });
    console.log(`Tersambung ke kantor "${r.officeName}" (${r.officeSlug}).\nKonfigurasi disimpan di ${p}\nJalankan: pnpm --filter @kantoraiku/runner start`);
    return;
  }

  const cfg = loadConfig();
  if (!cfg) throw new Error(`Belum dipasangkan. Jalankan "pair <KODE>" dulu. (${configPath()})`);

  if (cmd === "status") {
    console.log({ kantor: `${cfg.officeName} (${cfg.officeSlug})`, server: cfg.server, perangkat: cfg.deviceId, otak: aiStatus(), modelOpenAI: DEFAULT_OPENAI_MODEL, modelClaude: DEFAULT_CLAUDE_MODEL });
    return;
  }
  if (cmd === "start") {
    console.log(`Konektor ${VERSION} untuk "${cfg.officeName}" di ${cfg.server}. Otak AI:`, aiStatus());
    await work(client(cfg), { once: values.once });
    return;
  }
  console.log(HELP);
}

main().catch((e) => {
  console.error(`Gagal: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
