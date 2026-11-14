import OpenAI from "openai";
import { outputJsonSchema } from "@kantoraiku/shared";
import { systemPrompt, userPrompt } from "../prompts.ts";
import { BrainError, type Brain } from "./types.ts";

/**
 * Otak OpenAI: Responses API dengan API key milik user (OPENAI_API_KEY di PC).
 * Riset memakai tool web_search bawaan; semua hasil lewat structured output (JSON Schema strict).
 * Biaya dicatat sebagai token; konversi ke dolar menunggu tabel harga per model.
 */
export const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";

export function openaiKeyStatus() {
  const k = process.env.OPENAI_API_KEY;
  return k && k.startsWith("sk-") ? "ok" : "missing_key";
}

export const openai: Brain = async (p, progress) => {
  if (openaiKeyStatus() !== "ok") throw new BrainError("OPENAI_API_KEY belum diisi di packages/runner/.env pada PC ini.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const kind = p.run.kind === "research" || p.run.kind === "script" || p.run.kind === "cs_reply" ? p.run.kind : "general";
  const model = p.agent.model || DEFAULT_OPENAI_MODEL;

  await progress(15, kind === "research" ? `Mencari topik di web (${model})` : `Menulis (${model})`);
  let resp;
  try {
    resp = await client.responses.create({
      model,
      instructions: systemPrompt(p),
      input: userPrompt(p),
      ...(kind === "research" ? { tools: [{ type: "web_search" as const }] } : {}),
      text: { format: { type: "json_schema", name: `${kind}_output`, schema: outputJsonSchema[kind], strict: true } },
    });
  } catch (e) {
    if (e instanceof OpenAI.APIError) {
      if (e.status === 401) throw new BrainError("API key OpenAI ditolak (401). Periksa OPENAI_API_KEY.");
      if (e.status === 429) throw new BrainError("Kuota atau batas kecepatan OpenAI habis (429). Coba lagi nanti.");
      if (e.status === 404) throw new BrainError(`Model "${model}" tidak ditemukan. Ganti model di pengaturan agent.`);
      throw new BrainError(`OpenAI error ${e.status ?? ""}: ${e.message}`.slice(0, 400));
    }
    throw e;
  }

  await progress(85, "Merapikan hasil");
  let output: unknown;
  try {
    output = JSON.parse(resp.output_text);
  } catch {
    throw new BrainError("Jawaban OpenAI bukan JSON yang valid.");
  }
  return {
    output,
    inputTokens: resp.usage?.input_tokens ?? 0,
    outputTokens: resp.usage?.output_tokens ?? 0,
    costUsdMicros: 0,
  };
};
