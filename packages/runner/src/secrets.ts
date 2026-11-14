import { SECRET_ENV, SECRET_KINDS, openSecret, type SecretKind } from "@kantoraiku/shared";

// Kunci API yang diisi di dashboard: dibuka di PC ini dengan kunci privat konektor, lalu dipasang sebagai env.
// Kunci dari dashboard menimpa nilai di .env; bila dihapus di dashboard, nilai .env semula dikembalikan.

const original = new Map<string, string | undefined>();

export type SealedSecret = { kind: string; ciphertext: string };

export async function applySecrets(secrets: SealedSecret[], privateKey: string, log: (...a: unknown[]) => void = () => {}) {
  const active = new Set<string>();
  for (const s of secrets) {
    if (!(SECRET_KINDS as readonly string[]).includes(s.kind)) continue;
    const env = SECRET_ENV[s.kind as SecretKind];
    try {
      const value = await openSecret(privateKey, s.kind as SecretKind, s.ciphertext);
      if (!original.has(env)) original.set(env, process.env[env]);
      process.env[env] = value;
      active.add(env);
    } catch {
      log(`Kunci ${env} dari dashboard tidak bisa dibuka di PC ini. Isi ulang kuncinya di dashboard.`);
    }
  }
  // Kunci yang dihapus di dashboard: kembalikan nilai .env semula (atau kosongkan).
  for (const [env, before] of original) {
    if (active.has(env)) continue;
    if (before === undefined) delete process.env[env];
    else process.env[env] = before;
    original.delete(env);
  }
  return active.size;
}
