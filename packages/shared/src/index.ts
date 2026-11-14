// Kontrak bersama server (apps/web) <-> konektor (packages/runner).
// Satu sumber: kedua sisi memvalidasi dengan skema yang sama.
import { z } from "zod";

export const TASK_KINDS = ["general", "research", "script", "video", "publish", "cs_reply"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const BRAINS = ["simulation", "openai", "claude"] as const;
export type Brain = (typeof BRAINS)[number];

/** 150 kata per menit: dasar perkiraan durasi narasi. */
export const WORDS_PER_SECOND = 2.5;

// ---------------------------------------------------------------------------
// Output agent per jenis tugas
// ---------------------------------------------------------------------------

export const Source = z.object({
  url: z.string().min(1).max(2000),
  title: z.string().min(1).max(300),
});

export const ResearchOutput = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(3).max(300),
        angle: z.string().max(1000),
        score: z.number().int().min(0).max(100),
        sources: z.array(Source).max(10),
      }),
    )
    .min(1)
    .max(5),
});
export type ResearchOutput = z.infer<typeof ResearchOutput>;

export const ScriptOutput = z.object({
  title: z.string().min(3).max(300),
  script: z.string().min(20).max(20000),
  visual_plan: z
    .array(z.object({ scene: z.string().min(1).max(500), visual: z.string().min(1).max(500) }))
    .max(40),
});
export type ScriptOutput = z.infer<typeof ScriptOutput>;

export const GeneralOutput = z.object({ summary_md: z.string().min(1).max(20000) });
export type GeneralOutput = z.infer<typeof GeneralOutput>;

/** Hasil render video di PC. File video tetap di PC; server hanya menyimpan keterangan dan cover kecil. */
export const VideoOutput = z.object({
  local_ref: z.string().min(1).max(1000),
  duration_s: z.number().int().min(1).max(600),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  voice: z.enum(["elevenlabs", "simulation"]),
  footage: z
    .array(z.object({ provider: z.literal("pexels"), url: z.string().max(2000), author: z.string().max(200), author_url: z.string().max(2000) }))
    .max(40),
});
export type VideoOutput = z.infer<typeof VideoOutput>;

/** Balasan agent CS. `handoff` = serahkan ke manusia (pertanyaan di luar info bisnis, keluhan, minta orang). */
export const CsReplyOutput = z.object({ reply: z.string().min(1).max(4000), handoff: z.boolean() });
export type CsReplyOutput = z.infer<typeof CsReplyOutput>;

export const outputSchemaFor = {
  research: ResearchOutput,
  script: ScriptOutput,
  general: GeneralOutput,
  video: VideoOutput,
  cs_reply: CsReplyOutput,
} as const;

/** Batas cover yang diunggah konektor (JPEG kecil untuk dashboard). */
export const COVER_MAX_BYTES = 200 * 1024;

/** JSON Schema untuk structured output (OpenAI strict mode: semua field wajib, tanpa field tambahan). */
const src = {
  type: "object",
  properties: { url: { type: "string" }, title: { type: "string" } },
  required: ["url", "title"],
  additionalProperties: false,
} as const;

export const outputJsonSchema = {
  research: {
    type: "object",
    properties: {
      topics: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            angle: { type: "string" },
            score: { type: "integer" },
            sources: { type: "array", items: src },
          },
          required: ["title", "angle", "score", "sources"],
          additionalProperties: false,
        },
      },
    },
    required: ["topics"],
    additionalProperties: false,
  },
  script: {
    type: "object",
    properties: {
      title: { type: "string" },
      script: { type: "string" },
      visual_plan: {
        type: "array",
        items: {
          type: "object",
          properties: { scene: { type: "string" }, visual: { type: "string" } },
          required: ["scene", "visual"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "script", "visual_plan"],
    additionalProperties: false,
  },
  general: {
    type: "object",
    properties: { summary_md: { type: "string" } },
    required: ["summary_md"],
    additionalProperties: false,
  },
  cs_reply: {
    type: "object",
    properties: { reply: { type: "string" }, handoff: { type: "boolean" } },
    required: ["reply", "handoff"],
    additionalProperties: false,
  },
} as const;

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// API perangkat
// ---------------------------------------------------------------------------

export const PairRequest = z.object({
  setupCode: z.string().trim().min(6).max(32),
  kind: z.enum(["pc_windows", "pc_mac", "vps_linux"]),
  name: z.string().trim().min(1).max(60),
  publicKey: z.string().min(16).max(200),
  version: z.string().max(40),
});
export type PairRequest = z.infer<typeof PairRequest>;

export const PairResponse = z.object({
  deviceId: z.uuid(),
  deviceToken: z.string(),
  officeSlug: z.string(),
  officeName: z.string(),
});
export type PairResponse = z.infer<typeof PairResponse>;

export const AiStatus = z.enum(["ok", "missing_key", "invalid_key"]);
export const HeartbeatRequest = z.object({
  version: z.string().max(40),
  aiStatus: z.object({ simulation: AiStatus, openai: AiStatus, claude: AiStatus }).partial(),
  activeRunIds: z.array(z.uuid()).max(10),
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;

export const WorkPackage = z.object({
  run: z.object({ id: z.uuid(), kind: z.enum(TASK_KINDS), triggerSource: z.string() }),
  agent: z.object({
    id: z.uuid(),
    name: z.string(),
    title: z.string(),
    jobDescription: z.string(),
    brain: z.enum(BRAINS),
    model: z.string().nullable(),
  }),
  task: z.object({ id: z.uuid(), name: z.string(), instructions: z.string() }),
  skills: z.array(z.object({ slug: z.string(), name: z.string(), body: z.string() })),
  channel: z
    .object({ id: z.uuid(), name: z.string(), niche: z.string(), language: z.string() })
    .nullable(),
  context: z.object({
    topics: z
      .array(z.object({ id: z.uuid(), title: z.string(), angle: z.string().nullable(), sources: z.array(Source) }))
      .optional(),
    revision: z
      .object({ contentId: z.uuid(), title: z.string(), script: z.string(), note: z.string() })
      .optional(),
    /** Untuk tugas video: naskah yang sudah disetujui. `note` terisi bila ini revisi video. */
    content: z
      .object({
        id: z.uuid(),
        title: z.string(),
        script: z.string(),
        visualPlan: z.array(z.object({ scene: z.string(), visual: z.string() })),
        revision: z.number().int().min(0),
        note: z.string().nullable(),
      })
      .optional(),
    /** Untuk tugas cs_reply: percakapan WhatsApp terakhir dan info bisnis kantor. */
    cs: z
      .object({
        conversationId: z.uuid(),
        customerName: z.string().nullable(),
        businessInfo: z.string(),
        messages: z.array(z.object({ from: z.enum(["customer", "agent", "human"]), text: z.string() })),
      })
      .optional(),
  }),
});
export type WorkPackage = z.infer<typeof WorkPackage>;

export const ProgressRequest = z.object({
  pct: z.number().int().min(0).max(100).optional(),
  message: z.string().max(300).optional(),
});

export const CompleteRequest = z.object({
  status: z.enum(["succeeded", "failed"]),
  output: z.unknown().optional(),
  error: z.string().max(2000).optional(),
  costUsdMicros: z.number().int().min(0).default(0),
  inputTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
});
export type CompleteRequest = z.input<typeof CompleteRequest>;

// ---------------------------------------------------------------------------
// Rahasia terenkripsi untuk PC
// ---------------------------------------------------------------------------

// Rahasia untuk PC (kunci API): dienkripsi di browser ke kunci publik X25519 perangkat, dibuka hanya di PC itu.
// Server menyimpan ciphertext saja dan tidak pernah bisa membukanya.
//
// Skema v1 (ECIES, hanya WebCrypto: jalan di browser modern dan Node 24):
//   ephemeral X25519 -> ECDH dengan kunci publik perangkat -> HKDF-SHA256 (salt = kunci publik ephemeral,
//   info = "kantoraiku-device-secret-v1:" + jenis) -> AES-256-GCM (AAD = jenis).
//   Format: "v1.<epk base64>.<iv base64>.<ciphertext+tag base64>".
// Jenis rahasia ikut diikat (info + AAD): ciphertext kunci ElevenLabs tidak bisa dipakai sebagai kunci lain.

export const SECRET_KINDS = ["openai_api_key", "anthropic_api_key", "elevenlabs_api_key", "pexels_api_key", "repliz_api_key"] as const;
export type SecretKind = (typeof SECRET_KINDS)[number];

/** Nama env di konektor untuk tiap jenis rahasia. */
export const SECRET_ENV: Record<SecretKind, string> = {
  openai_api_key: "OPENAI_API_KEY",
  anthropic_api_key: "ANTHROPIC_API_KEY",
  elevenlabs_api_key: "ELEVENLABS_API_KEY",
  pexels_api_key: "PEXELS_API_KEY",
  repliz_api_key: "REPLIZ_API_KEY",
};

export const SEALED_PATTERN = /^v1\.[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*\.[A-Za-z0-9+/]+=*$/;

const enc = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

const toB64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(shared: ArrayBuffer, epk: Uint8Array, kind: SecretKind, usage: "encrypt" | "decrypt") {
  const base = await subtle().importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: epk as Uint8Array<ArrayBuffer>, info: enc.encode(`kantoraiku-device-secret-v1:${kind}`) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

/** Enkripsi rahasia untuk satu perangkat. `devicePublicKey` = kunci publik X25519 mentah (base64). */
export async function sealSecret(devicePublicKey: string, kind: SecretKind, secret: string) {
  const s = subtle();
  const devPub = await s.importKey("raw", fromB64(devicePublicKey), { name: "X25519" }, false, []);
  const eph = (await s.generateKey({ name: "X25519" }, true, ["deriveBits"])) as CryptoKeyPair;
  const epk = new Uint8Array(await s.exportKey("raw", eph.publicKey));
  const shared = await s.deriveBits({ name: "X25519", public: devPub }, eph.privateKey, 256);
  const key = await aesKey(shared, epk, kind, "encrypt");
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await s.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(kind) }, key, enc.encode(secret));
  return `v1.${toB64(epk)}.${toB64(iv)}.${toB64(ct)}`;
}

/** Buka rahasia di perangkat. `privateKeyPkcs8` = kunci privat X25519 (PKCS8 DER, base64). */
export async function openSecret(privateKeyPkcs8: string, kind: SecretKind, sealed: string) {
  if (!SEALED_PATTERN.test(sealed)) throw new Error("Format rahasia tidak dikenal.");
  const [, epkB64, ivB64, ctB64] = sealed.split(".");
  const s = subtle();
  const epk = fromB64(epkB64);
  const priv = await s.importKey("pkcs8", fromB64(privateKeyPkcs8), { name: "X25519" }, false, ["deriveBits"]);
  const pub = await s.importKey("raw", epk, { name: "X25519" }, false, []);
  const shared = await s.deriveBits({ name: "X25519", public: pub }, priv, 256);
  const key = await aesKey(shared, epk, kind, "decrypt");
  const plain = await s.decrypt({ name: "AES-GCM", iv: fromB64(ivB64), additionalData: enc.encode(kind) }, key, fromB64(ctB64));
  return new TextDecoder().decode(plain);
}

/** 4 karakter terakhir untuk ditampilkan ("••••abcd"). */
export const secretHint = (secret: string) => secret.trim().slice(-4);
