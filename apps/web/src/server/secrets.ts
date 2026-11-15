import "server-only";
import { SEALED_PATTERN, SECRET_KINDS, type SecretKind } from "@kantoraiku/shared";
import { db, many, one } from "./db";
import { addActivity } from "./office";

// Kunci API untuk PC (S30). Browser mengenkripsi ke kunci publik perangkat; server hanya menyimpan ciphertext.
// Semua fungsi menerima officeId yang sudah dicek lewat requireMember().

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSecretKind = (k: string): k is SecretKind => (SECRET_KINDS as readonly string[]).includes(k);

export async function listKeys(officeId: string) {
  const d = await db();
  const [devices, secrets] = await Promise.all([
    many<{ id: string; name: string; kind: string; status: string; public_key: string; ai_status: Record<string, string> }>(
      d,
      `select id, name, kind, status, public_key, ai_status from public.devices where office_id = $1 and status <> 'revoked' order by created_at`,
      [officeId],
    ),
    many<{ device_id: string; kind: SecretKind; hint: string | null; updated_at: string }>(
      d,
      `select device_id, kind, hint, updated_at from public.device_secrets where office_id = $1`,
      [officeId],
    ),
  ]);
  return devices.map((dev) => ({ ...dev, secrets: secrets.filter((s) => s.device_id === dev.id) }));
}

export async function saveKey(officeId: string, deviceId: string, kind: string, ciphertext: string, hint: string) {
  if (!UUID.test(deviceId) || !isSecretKind(kind)) return { error: "Data tidak valid." };
  if (!SEALED_PATTERN.test(ciphertext) || ciphertext.length > 8000) return { error: "Kunci harus dienkripsi di browser dulu." };
  const d = await db();
  const dev = await one<{ name: string }>(d, `select name from public.devices where office_id = $1 and id = $2 and status <> 'revoked'`, [officeId, deviceId]);
  if (!dev) return { error: "Perangkat tidak ditemukan." };
  await d.query(
    `insert into public.device_secrets (office_id, device_id, kind, ciphertext, hint) values ($1, $2, $3, $4, $5)
     on conflict (device_id, kind) do update set ciphertext = excluded.ciphertext, hint = excluded.hint, updated_at = now()`,
    [officeId, deviceId, kind, ciphertext, hint.slice(-4) || null],
  );
  await addActivity(d, officeId, "secret.saved", `Kunci ${LABEL[kind]} untuk ${dev.name} diperbarui`);
  return { ok: true as const };
}

export async function removeKey(officeId: string, deviceId: string, kind: string) {
  if (!UUID.test(deviceId) || !isSecretKind(kind)) return;
  await (await db()).query(`delete from public.device_secrets where office_id = $1 and device_id = $2 and kind = $3`, [officeId, deviceId, kind]);
}

export const LABEL: Record<SecretKind, string> = {
  openai_api_key: "OpenAI",
  anthropic_api_key: "Anthropic (Claude)",
  elevenlabs_api_key: "ElevenLabs",
  pexels_api_key: "Pexels",
  fal_api_key: "fal (gambar AI)",
  repliz_api_key: "Repliz",
};
