import { test } from "node:test";
import assert from "node:assert/strict";
import { CsReplyOutput } from "@kantoraiku/shared";
import { simulateCsReply } from "../src/brains/simulation.ts";
import { csPrompt } from "../src/prompts.ts";

const cs = (last: string) => ({
  conversationId: "00000000-0000-4000-8000-000000000009",
  customerName: "Rina",
  businessInfo: "## Jam buka\nToko buka setiap hari pukul 09.00 sampai 21.00. Hari Minggu tutup lebih awal.\n\n## Ongkir\nGratis ongkir untuk pembelian di atas Rp100.000.",
  messages: [
    { from: "customer" as const, text: "Halo kak" },
    { from: "agent" as const, text: "Halo, ada yang bisa dibantu?" },
    { from: "customer" as const, text: last },
  ],
});

test("simulasi CS: jawab dari bagian info bisnis yang cocok", () => {
  const r = CsReplyOutput.parse(simulateCsReply(cs("Tokonya buka jam berapa ya?")));
  assert.equal(r.handoff, false);
  assert.match(r.reply, /09\.00 sampai 21\.00/);
});

test("simulasi CS: tidak ada di info bisnis -> serahkan ke manusia", () => {
  const r = simulateCsReply(cs("Bisa bayar pakai kartu kredit?"));
  assert.equal(r.handoff, true);
  assert.match(r.reply, /teruskan ke tim/);
});

test("prompt CS: berisi aturan, info bisnis, dan percakapan berurutan", () => {
  const p = csPrompt(cs("Ongkirnya berapa?"));
  assert.match(p, /handoff = true/);
  assert.match(p, /## Ongkir/);
  assert.ok(p.indexOf("Pelanggan: Halo kak") < p.indexOf("Pelanggan: Ongkirnya berapa?"));
  assert.match(p, /Kamu: Halo, ada yang bisa dibantu\?/);
  assert.match(p, /dari Rina/);
});
