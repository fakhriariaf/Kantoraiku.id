import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Konfigurasi konektor: di folder data user, bukan di repo. */
export type ConnectorConfig = {
  server: string;
  deviceId: string;
  deviceToken: string;
  officeSlug: string;
  officeName: string;
  publicKey: string; // X25519 raw base64
  privateKey: string; // PKCS8 DER base64 (untuk membuka kunci dari dashboard, Fase 1 lanjutan)
};

export function configDir() {
  const base = process.env.APPDATA ?? join(homedir(), ".config");
  return join(base, "Kantoraiku");
}

export const configPath = () => join(process.env.KANTORAIKU_CONFIG_DIR ?? configDir(), "connector.json");

export function loadConfig(): ConnectorConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as ConnectorConfig;
}

export function saveConfig(c: ConnectorConfig) {
  const p = configPath();
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(c, null, 2), { mode: 0o600 });
  try {
    chmodSync(p, 0o600);
  } catch {
    // Windows: izin file diatur oleh ACL folder profil user.
  }
  return p;
}

/** Lupakan kantor di PC ini (token dan kunci privat dihapus). */
export function clearConfig() {
  rmSync(configPath(), { force: true });
}

export const VERSION = "0.1.0-dev";
