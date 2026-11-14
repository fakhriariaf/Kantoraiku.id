import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { sealSecret } from "@kantoraiku/shared";
import { applySecrets } from "../src/secrets.ts";

const pc = () => {
  const kp = generateKeyPairSync("x25519");
  return {
    pub: kp.publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("base64"),
    priv: kp.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  };
};

test("kunci dari dashboard menimpa .env, dan nilai .env kembali saat kunci dihapus", async () => {
  const { pub, priv } = pc();
  process.env.PEXELS_API_KEY = "dari-env";
  delete process.env.ELEVENLABS_API_KEY;
  const sealed = [
    { kind: "pexels_api_key", ciphertext: await sealSecret(pub, "pexels_api_key", "dari-dashboard") },
    { kind: "elevenlabs_api_key", ciphertext: await sealSecret(pub, "elevenlabs_api_key", "eleven-rahasia") },
  ];
  assert.equal(await applySecrets(sealed, priv), 2);
  assert.equal(process.env.PEXELS_API_KEY, "dari-dashboard");
  assert.equal(process.env.ELEVENLABS_API_KEY, "eleven-rahasia");

  await applySecrets([], priv);
  assert.equal(process.env.PEXELS_API_KEY, "dari-env");
  assert.equal(process.env.ELEVENLABS_API_KEY, undefined);
});

test("kunci yang dibuat untuk PC lain tidak terpasang", async () => {
  const a = pc();
  const b = pc();
  delete process.env.OPENAI_API_KEY;
  const logs: string[] = [];
  const n = await applySecrets([{ kind: "openai_api_key", ciphertext: await sealSecret(a.pub, "openai_api_key", "sk-milik-pc-a") }], b.priv, (m) => logs.push(String(m)));
  assert.equal(n, 0);
  assert.equal(process.env.OPENAI_API_KEY, undefined);
  assert.match(logs[0], /tidak bisa dibuka/);
});

test("ciphertext yang dipindah ke jenis lain ditolak", async () => {
  const { pub, priv } = pc();
  delete process.env.ANTHROPIC_API_KEY;
  const forOpenai = await sealSecret(pub, "openai_api_key", "sk-openai");
  assert.equal(await applySecrets([{ kind: "anthropic_api_key", ciphertext: forOpenai }], priv), 0);
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
});
