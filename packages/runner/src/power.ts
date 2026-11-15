import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";

/**
 * Apakah PC ini sedang memakai baterai (laptop tidak dicas)? Dipakai untuk "buat video hanya saat dicas".
 * PC tanpa baterai, VPS, atau bila tidak bisa dicek: false (tidak pernah menghalangi kerja).
 * Hasil disimpan 60 detik supaya heartbeat tidak menjalankan PowerShell setiap 30 detik.
 */
let cache: { at: number; value: boolean } | null = null;

const run = (cmd: string, args: string[]) =>
  new Promise<string>((resolve) =>
    execFile(cmd, args, { timeout: 8_000, windowsHide: true }, (err, stdout) => resolve(err ? "" : String(stdout))),
  );

async function detect(): Promise<boolean> {
  if (process.platform === "win32") {
    // BatteryStatus 1 = sedang dipakai (tidak dicas); 2 dst = tersambung listrik. Tanpa baterai: kosong.
    const out = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-CimInstance Win32_Battery | Select-Object -First 1).BatteryStatus"]);
    return out.trim() === "1";
  }
  if (process.platform === "darwin") {
    return /'Battery Power'/.test(await run("pmset", ["-g", "batt"]));
  }
  try {
    const dir = "/sys/class/power_supply";
    const ac = (await readdir(dir)).filter((n) => /^(AC|ADP|ACAD)/i.test(n));
    if (!ac.length) return false;
    const online = await Promise.all(ac.map((n) => readFile(`${dir}/${n}/online`, "utf8").catch(() => "1")));
    return online.every((v) => v.trim() === "0");
  } catch {
    return false;
  }
}

export async function onBattery(): Promise<boolean> {
  const forced = process.env.KANTORAIKU_ON_BATTERY;
  if (forced === "1" || forced === "0") return forced === "1"; // untuk uji
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const value = await detect().catch(() => false);
  cache = { at: Date.now(), value };
  return value;
}
