import { generateKeyPairSync } from "node:crypto";
import { hostname, platform } from "node:os";
import { pairDevice } from "./api.ts";
import { saveConfig, VERSION, type ConnectorConfig } from "./config.ts";

export const defaultPcName = () => `PC ${hostname()}`.slice(0, 60);

/** Pasangkan PC ini ke kantor dengan kode setup sekali pakai, lalu simpan konfigurasinya. */
export async function pairPc(opts: { server: string; code: string; name?: string; version?: string }): Promise<{ config: ConnectorConfig; path: string }> {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const pubRaw = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64");
  const r = await pairDevice(opts.server, {
    setupCode: opts.code,
    kind: platform() === "darwin" ? "pc_mac" : "pc_windows",
    name: (opts.name?.trim() || defaultPcName()).slice(0, 60),
    publicKey: pubRaw,
    version: opts.version ?? VERSION,
  });
  const config: ConnectorConfig = {
    server: opts.server,
    deviceId: r.deviceId,
    deviceToken: r.deviceToken,
    officeSlug: r.officeSlug,
    officeName: r.officeName,
    publicKey: pubRaw,
    privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
  return { config, path: saveConfig(config) };
}
