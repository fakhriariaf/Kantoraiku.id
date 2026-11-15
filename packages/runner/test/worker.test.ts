import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, type Api } from "../src/api.ts";
import { work, type WorkerEvent } from "../src/worker.ts";

const quiet = () => {};
const RUN = "00000000-0000-4000-8000-000000000001";

function fakeApi(over: Partial<Api> = {}): Api & { completed: unknown[]; beats: string[] } {
  const completed: unknown[] = [];
  const beats: string[] = [];
  return {
    completed,
    beats,
    heartbeat: async (h) => {
      beats.push(h.version);
      return { hasWork: false };
    },
    secrets: async () => ({ secrets: [] }),
    claim: async () => null,
    progress: async () => ({ cancel: false }),
    complete: async (_id, c) => {
      completed.push(c);
      return null;
    },
    uploadCover: async () => {},
    ...over,
  };
}

const pkg = {
  run: { id: RUN, kind: "general", triggerSource: "manual" },
  agent: { id: "00000000-0000-4000-8000-000000000002", name: "Dimas", title: "Asisten", jobDescription: "Bantu", brain: "simulation", model: null, skills: [] },
  task: { id: "00000000-0000-4000-8000-000000000003", name: "Ringkas", instructions: "Ringkas berita hari ini." },
  context: {},
};

test("worker: antrean kosong + once -> drained, versi aplikasi dilaporkan", async () => {
  const api = fakeApi();
  const r = await work(api, { officeSlug: "x", privateKey: "", once: true, version: "0.2.0", log: quiet });
  assert.equal(r, "drained");
  assert.deepEqual(api.beats, ["0.2.0"]);
});

test("worker: token ditolak (dicabut) -> revoked tanpa process.exit", async () => {
  const api = fakeApi({
    heartbeat: async () => {
      throw new HttpError(401, "dicabut");
    },
  });
  const events: WorkerEvent[] = [];
  const r = await work(api, { officeSlug: "x", privateKey: "", log: quiet, onEvent: (e) => events.push(e) });
  assert.equal(r, "revoked");
  assert.equal(events.length, 0);
});

test("worker: abort saat menganggur -> stopped dengan cepat", async () => {
  const api = fakeApi();
  const stop = new AbortController();
  const t0 = Date.now();
  setTimeout(() => stop.abort(), 50);
  const r = await work(api, { officeSlug: "x", privateKey: "", log: quiet, signal: stop.signal });
  assert.equal(r, "stopped");
  assert.ok(Date.now() - t0 < 2_000);
});

test("worker: menjalankan tugas dan mengirim event mulai/progres/selesai", async () => {
  let given = false;
  const api = fakeApi({
    claim: async () => {
      if (given) return null;
      given = true;
      return pkg as never;
    },
  });
  const events: WorkerEvent[] = [];
  const r = await work(api, { officeSlug: "x", privateKey: "", once: true, log: quiet, onEvent: (e) => events.push(e) });
  assert.equal(r, "drained");
  const types = events.map((e) => e.type);
  assert.equal(types[0], "online");
  assert.ok(types.includes("run_start"));
  assert.ok(types.includes("progress"));
  const end = events.find((e) => e.type === "run_end");
  assert.ok(end && end.type === "run_end" && end.ok, JSON.stringify(api.completed));
  assert.equal((api.completed[0] as { status: string }).status, "succeeded");
});
