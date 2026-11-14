import Anthropic from "@anthropic-ai/sdk";
import { outputJsonSchema, type WorkPackage } from "@kantoraiku/shared";
import { systemPrompt, userPrompt } from "../prompts.ts";
import { BrainError, type Brain } from "./types.ts";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Msg = Anthropic.Beta.Messages.BetaMessage;

/**
 * Otak Claude: Messages API dengan API key milik user (ANTHROPIC_API_KEY di PC).
 *
 * Riset dua langkah, karena web search selalu menyertakan sitasi dan structured output menolak sitasi:
 *   1. cari di web (tool web_search) dan tulis catatan riset;
 *   2. ubah catatan jadi JSON lewat structured output, hanya memakai URL yang benar-benar ditemukan.
 * Naskah dan tugas umum: satu panggilan dengan structured output.
 */
export const DEFAULT_CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** Model yang menerima fallback server-side `"default"` saat permintaan ditolak filter keamanan. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-2", "claude-fable-5-1"]);
/** Model lama (Haiku 4.5, Sonnet 4.5, dst.) menolak `effort`. */
const supportsEffort = (m: string) => /^claude-(opus|sonnet|haiku|fable|mythos)-5/.test(m) || /^claude-(opus-4-[678]|sonnet-4-6)/.test(m);

/** Harga per token dalam mikro-dolar (input, output). Perkiraan biaya; model lain dicatat 0. */
const PRICE: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-2": [8, 40],
};
const WEB_SEARCH_MICROS = 10_000; // $10 per 1.000 pencarian

export function claudeKeyStatus() {
  const k = process.env.ANTHROPIC_API_KEY;
  return k && k.startsWith("sk-ant-") ? "ok" : "missing_key";
}

type Tally = { input: number; output: number; micros: number };

function tally(t: Tally, m: Msg) {
  t.input += m.usage.input_tokens;
  t.output += m.usage.output_tokens;
  const price = PRICE[m.model];
  if (price) t.micros += Math.round(m.usage.input_tokens * price[0] + m.usage.output_tokens * price[1]);
  t.micros += (m.usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_MICROS;
}

function text(m: Msg) {
  return m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

/** URL yang benar-benar muncul di hasil pencarian atau sitasi, untuk menyaring sumber karangan. */
function foundSources(m: Msg) {
  const out = new Map<string, string>();
  for (const b of m.content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) out.set(r.url, r.title);
    }
    if (b.type === "text") {
      for (const c of b.citations ?? []) if (c.type === "web_search_result_location") out.set(c.url, c.title ?? c.url);
    }
  }
  return out;
}

function explain(e: unknown, model: string): never {
  if (e instanceof Anthropic.AuthenticationError) throw new BrainError("API key Anthropic ditolak (401). Periksa ANTHROPIC_API_KEY.");
  if (e instanceof Anthropic.PermissionDeniedError) throw new BrainError("API key Anthropic tidak punya akses ke fitur atau model ini (403).");
  if (e instanceof Anthropic.NotFoundError) throw new BrainError(`Model "${model}" tidak ditemukan. Ganti model di pengaturan agent.`);
  if (e instanceof Anthropic.RateLimitError) throw new BrainError("Batas kecepatan atau kuota Anthropic habis (429). Coba lagi nanti.");
  if (e instanceof Anthropic.BadRequestError) throw new BrainError(`Permintaan ditolak Anthropic (400): ${e.message}`.slice(0, 400));
  if (e instanceof Anthropic.APIConnectionError) throw new BrainError("Tidak bisa terhubung ke Anthropic. Periksa internet PC ini.");
  if (e instanceof Anthropic.APIError) throw new BrainError(`Anthropic error ${e.status ?? ""}: ${e.message}`.slice(0, 400));
  throw e;
}

function checkStop(m: Msg) {
  if (m.stop_reason === "refusal") {
    const why = m.stop_details?.category ? ` (kategori: ${m.stop_details.category})` : "";
    throw new BrainError(`Claude menolak mengerjakan permintaan ini${why}. Ubah instruksi tugas atau job desk.`);
  }
  if (m.stop_reason === "max_tokens") throw new BrainError("Jawaban Claude terpotong (batas token). Coba lagi atau persingkat instruksi.");
}

export function claudeBrain(makeClient: () => Anthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })): Brain {
  return async (p, progress) => {
    if (claudeKeyStatus() !== "ok") throw new BrainError("ANTHROPIC_API_KEY belum diisi di packages/runner/.env pada PC ini.");
    const client = makeClient();
    const kind = p.run.kind === "research" || p.run.kind === "script" || p.run.kind === "cs_reply" ? p.run.kind : "general";
    const model = p.agent.model || DEFAULT_CLAUDE_MODEL;
    const t: Tally = { input: 0, output: 0, micros: 0 };

    const base = (effort: "low" | "medium"): Pick<Params, "model" | "max_tokens" | "betas" | "fallbacks" | "output_config"> => ({
      model,
      max_tokens: 16000,
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      ...(supportsEffort(model) ? { output_config: { effort } } : {}),
    });

    const call = async (params: Params) => {
      try {
        return await client.beta.messages.create(params);
      } catch (e) {
        explain(e, model);
      }
    };

    /** Panggilan structured output: hasil dijamin JSON sesuai skema (divalidasi lagi dengan zod di worker). */
    const structured = async (system: string, user: string, effort: "low" | "medium") => {
      const b = base(effort);
      const m = await call({
        ...b,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { ...b.output_config, format: { type: "json_schema", schema: outputJsonSchema[kind] } },
      });
      tally(t, m);
      checkStop(m);
      try {
        return JSON.parse(text(m)) as unknown;
      } catch {
        throw new BrainError("Jawaban Claude bukan JSON yang valid.");
      }
    };

    let output: unknown;
    if (kind === "research") {
      await progress(15, `Mencari topik di web (${model})`);
      const notes = await research(p, base("medium"), call, t);
      await progress(70, "Menyusun hasil riset");
      const known = [...notes.sources].map(([url, title]) => `- ${title}: ${url}`).join("\n");
      output = await structured(
        systemPrompt(p),
        [
          "Ubah catatan riset berikut menjadi JSON sesuai skema.",
          "Pakai hanya URL yang ada di catatan atau di daftar sumber. Jangan menambah sumber baru.",
          `Catatan riset:\n${notes.text}`,
          known && `Sumber yang ditemukan saat pencarian:\n${known}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        "low",
      );
      output = keepFoundSources(output, notes.sources);
    } else {
      await progress(15, kind === "cs_reply" ? `Membalas chat (${model})` : `Menulis (${model})`);
      output = await structured(systemPrompt(p), userPrompt(p), "medium");
    }

    await progress(85, "Merapikan hasil");
    return { output, inputTokens: t.input, outputTokens: t.output, costUsdMicros: t.micros };
  };
}

/** Langkah 1 riset: web search, dengan lanjutan bila server menjeda giliran (`pause_turn`). */
async function research(
  p: WorkPackage,
  base: Pick<Params, "model" | "max_tokens" | "betas" | "fallbacks" | "output_config">,
  call: (params: Params) => Promise<Msg>,
  t: Tally,
) {
  const user = [
    userPrompt(p),
    "Cari di web dulu. Lalu tulis catatan riset singkat: untuk tiap topik, judul, sudut pandang, alasan skornya, dan sumbernya (judul dan URL persis dari hasil pencarian).",
  ].join("\n\n");
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: user }];
  const sources = new Map<string, string>();
  let notes = "";
  for (let i = 0; i < 5; i++) {
    const m = await call({
      ...base,
      system: systemPrompt(p, { json: false }),
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    });
    tally(t, m);
    checkStop(m);
    for (const [url, title] of foundSources(m)) sources.set(url, title);
    notes += text(m);
    if (m.stop_reason !== "pause_turn") return { text: notes, sources };
    // Server menjeda giliran panjang: kirim balik pesan assistant apa adanya (pesan assistant berurutan
    // digabung jadi satu giliran), server melanjutkan tanpa pesan "lanjut" dari kita.
    messages.push({ role: "assistant", content: m.content });
  }
  throw new BrainError("Pencarian web terlalu lama (dijeda berkali-kali). Coba lagi nanti.");
}

/** Buang sumber yang URL-nya tidak pernah muncul di hasil pencarian. */
function keepFoundSources(output: unknown, found: Map<string, string>) {
  if (!found.size || typeof output !== "object" || output === null || !("topics" in output) || !Array.isArray(output.topics)) return output;
  for (const topic of output.topics as { sources?: { url: string }[] }[]) {
    if (Array.isArray(topic.sources)) topic.sources = topic.sources.filter((s) => found.has(s.url));
  }
  return output;
}

export const claude: Brain = claudeBrain();
