// Uji otak Claude terhadap server Anthropic palsu (lokal): tanpa API key asli, tanpa biaya.
// Menguji bentuk request, lanjutan pause_turn, penyaringan sumber, biaya, dan pesan error.
// Jalankan: pnpm --filter @kantoraiku/runner test
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import Anthropic from "@anthropic-ai/sdk";
import { ResearchOutput, ScriptOutput, type WorkPackage } from "@kantoraiku/shared";
import { claudeBrain } from "../src/brains/claude.ts";
import { BrainError } from "../src/brains/types.ts";

type Seen = { body: Record<string, any>; headers: IncomingMessage["headers"] };
let server: Server;
let seen: Seen[] = [];
let replies: { status?: number; body: unknown }[] = [];

const usage = (input: number, output: number, searches = 0) => ({
  input_tokens: input,
  output_tokens: output,
  server_tool_use: { web_search_requests: searches, web_fetch_requests: 0 },
});
const msg = (content: unknown[], stop_reason: string, u = usage(10, 5), extra: object = {}) => ({
  id: `msg_${seen.length}`,
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  usage: u,
  ...extra,
});

before(async () => {
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    seen.push({ body: JSON.parse(raw), headers: req.headers });
    const r = replies.shift() ?? { status: 500, body: { type: "error", error: { type: "api_error", message: "tak ada balasan" } } };
    res.writeHead(r.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
});
after(() => server.close());
beforeEach(() => {
  seen = [];
  replies = [];
  process.env.ANTHROPIC_API_KEY = "sk-ant-uji-lokal";
});

const brain = () =>
  claudeBrain(
    () =>
      new Anthropic({
        apiKey: "sk-ant-uji-lokal",
        baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        maxRetries: 0,
      }),
  );

const ID = "00000000-0000-4000-8000-000000000001";
const pkg = (kind: "research" | "script", model: string | null = null): WorkPackage => ({
  run: { id: ID, kind, triggerSource: "manual" },
  agent: { id: ID, name: "Dimas", title: "Periset", jobDescription: "Cari tren.", brain: "claude", model },
  task: { id: ID, name: "Riset pagi", instructions: "" },
  skills: [],
  channel: { id: ID, name: "Resep 10 menit", niche: "masak cepat", language: "id" },
  context: {},
});
const progress: string[] = [];
const onProgress = async (_pct: number, m: string) => {
  progress.push(m);
};

test("riset: web search, lanjut setelah pause_turn, lalu JSON; sumber karangan dibuang", async () => {
  replies = [
    {
      body: msg(
        [
          { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "resep viral" } },
          {
            type: "web_search_tool_result",
            tool_use_id: "srv_1",
            content: [{ type: "web_search_result", url: "https://a.contoh/1", title: "Sumber A", encrypted_content: "x", page_age: null }],
          },
        ],
        "pause_turn",
        usage(1000, 100, 1),
      ),
    },
    {
      body: msg(
        [
          {
            type: "text",
            text: "Topik 1: mi goreng 5 menit.",
            citations: [{ type: "web_search_result_location", url: "https://b.contoh/2", title: "Sumber B", cited_text: "...", encrypted_index: "y" }],
          },
        ],
        "end_turn",
        usage(2000, 300, 1),
      ),
    },
    {
      body: msg(
        [
          {
            type: "text",
            text: JSON.stringify({
              topics: [
                {
                  title: "Mi goreng 5 menit",
                  angle: "Lebih cepat dari ojol",
                  score: 88,
                  sources: [
                    { url: "https://a.contoh/1", title: "Sumber A" },
                    { url: "https://b.contoh/2", title: "Sumber B" },
                    { url: "https://karangan.contoh/x", title: "Tidak pernah dicari" },
                  ],
                },
              ],
            }),
          },
        ],
        "end_turn",
        usage(500, 200),
      ),
    },
  ];

  const r = await brain()(pkg("research"), onProgress);

  assert.equal(seen.length, 3);
  const [first, resumed, shape] = seen;
  // Langkah 1: web search terbaru, fallback default, effort eksplisit, tanpa structured output.
  assert.equal(first.body.model, "claude-opus-5-5");
  assert.deepEqual(first.body.tools, [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
  assert.equal(first.body.fallbacks, "default");
  assert.match(String(first.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.deepEqual(first.body.output_config, { effort: "medium" });
  assert.doesNotMatch(first.body.system, /format JSON/);
  // pause_turn: pesan assistant dikirim balik apa adanya, tanpa pesan user tambahan.
  assert.deepEqual(
    resumed.body.messages.map((m: { role: string }) => m.role),
    ["user", "assistant"],
  );
  assert.equal(resumed.body.messages[1].content[0].type, "server_tool_use");
  // Langkah 2: structured output tanpa tool, daftar sumber yang ditemukan ikut dikirim.
  assert.equal(shape.body.tools, undefined);
  assert.equal(shape.body.output_config.format.type, "json_schema");
  assert.equal(shape.body.output_config.effort, "low");
  assert.match(shape.body.messages[0].content, /https:\/\/a\.contoh\/1/);
  assert.match(shape.body.messages[0].content, /https:\/\/b\.contoh\/2/);

  const out = ResearchOutput.parse(r.output);
  assert.deepEqual(
    out.topics[0].sources.map((s) => s.url),
    ["https://a.contoh/1", "https://b.contoh/2"],
  );
  assert.equal(r.inputTokens, 3500);
  assert.equal(r.outputTokens, 600);
  // 3500 x 4 + 600 x 20 mikro-dolar + 2 pencarian x 10.000
  assert.equal(r.costUsdMicros, 3500 * 4 + 600 * 20 + 2 * 10_000);
  assert.ok(progress.some((m) => m.startsWith("Mencari topik di web")));
});

test("naskah: satu panggilan structured output", async () => {
  const naskah = { title: "Mi goreng 5 menit", script: "Lapar tapi malas masak? Ini caranya dalam lima menit saja.", visual_plan: [{ scene: "Pembuka", visual: "Mi di wajan" }] };
  replies = [{ body: msg([{ type: "text", text: JSON.stringify(naskah) }], "end_turn") }];
  const r = await brain()(pkg("script"), onProgress);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].body.tools, undefined);
  assert.equal(seen[0].body.output_config.format.type, "json_schema");
  assert.deepEqual(ScriptOutput.parse(r.output), naskah);
});

test("model lain dari pengaturan agent: tanpa fallback dan tanpa effort bila tidak didukung", async () => {
  replies = [{ body: msg([{ type: "text", text: JSON.stringify({ title: "Judul", script: "Naskah yang cukup panjang untuk lolos.", visual_plan: [] }) }], "end_turn") }];
  await brain()(pkg("script", "claude-haiku-4-5"), onProgress);
  assert.equal(seen[0].body.model, "claude-haiku-4-5");
  assert.equal(seen[0].body.fallbacks, undefined);
  assert.equal(seen[0].body.output_config.effort, undefined);
  assert.equal(seen[0].body.output_config.format.type, "json_schema");
});

test("penolakan (refusal) jadi pesan yang jelas", async () => {
  replies = [{ body: msg([], "refusal", usage(10, 0), { stop_details: { type: "refusal", category: "cyber", explanation: null } }) }];
  await assert.rejects(brain()(pkg("script"), onProgress), (e: unknown) => e instanceof BrainError && /menolak.*cyber/.test(e.message));
});

test("API key ditolak (401) jadi pesan Indonesia", async () => {
  replies = [{ status: 401, body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }];
  await assert.rejects(brain()(pkg("script"), onProgress), (e: unknown) => e instanceof BrainError && /ditolak \(401\)/.test(e.message));
});

test("tanpa ANTHROPIC_API_KEY: gagal sebelum memanggil API", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(brain()(pkg("script"), onProgress), (e: unknown) => e instanceof BrainError && /ANTHROPIC_API_KEY belum diisi/.test(e.message));
  assert.equal(seen.length, 0);
});
