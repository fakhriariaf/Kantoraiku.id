import "server-only";
import {
  CompleteRequest,
  HeartbeatRequest,
  PairRequest,
  ProgressRequest,
  ResearchOutput,
  ScriptOutput,
  GeneralOutput,
  VideoOutput,
  CsReplyOutput,
  COVER_MAX_BYTES,
  WORDS_PER_SECOND,
  countWords,
  type WorkPackage,
} from "@kantoraiku/shared";
import { z } from "zod";
import { db, many, one, type Sql } from "./db";
import { randomToken, sha256 } from "./crypto";
import { addActivity } from "./office";
import { supabaseAdmin } from "./supabase";
import { csContext, deliver, recordAgentReply } from "./cs";

export type Device = { id: string; office_id: string; name: string; kind: string; capabilities: string[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Authorization: Bearer <device token>. Hanya hash token yang disimpan. */
export async function authDevice(req: Request): Promise<Device> {
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Token perangkat tidak ada.");
  const dev = await one<Device>(
    await db(),
    `select d.id, d.office_id, d.name, d.kind, d.capabilities from public.devices d
       join public.offices o on o.id = d.office_id
      where d.token_hash = $1 and d.status <> 'revoked' and o.status = 'active'`,
    [sha256(token)],
  );
  if (!dev) throw new ApiError(401, "Perangkat tidak dikenal atau sudah dicabut.");
  return dev;
}

export async function pair(body: unknown) {
  const p = PairRequest.parse(body);
  const d = await db();
  return d.transaction(async (tx) => {
    const code = await one<{ id: string; office_id: string }>(
      tx,
      `select id, office_id from public.setup_codes
        where code_hash = $1 and used_at is null and expires_at > now() for update`,
      [sha256(p.setupCode.replace(/\s/g, "").toUpperCase())],
    );
    if (!code) throw new ApiError(400, "Kode setup salah, sudah dipakai, atau kedaluwarsa. Buat kode baru di dashboard.");
    const office = await one<{ slug: string; display_name: string; pc_slots: number; pcs: number; vps: number }>(
      tx,
      `select o.slug, o.display_name, o.pc_slots,
              (select count(*)::int from public.devices where office_id = o.id and status <> 'revoked' and kind like 'pc_%') as pcs,
              (select count(*)::int from public.devices where office_id = o.id and status <> 'revoked' and kind = 'vps_linux') as vps
         from public.offices o where o.id = $1 and o.status = 'active'`,
      [code.office_id],
    );
    if (!office) throw new ApiError(400, "Kantor tidak aktif.");
    const isPc = p.kind.startsWith("pc_");
    if (isPc && office.pcs >= office.pc_slots) throw new ApiError(409, "Slot PC kantor ini sudah penuh. Cabut PC lama dulu di dashboard.");
    if (!isPc && office.vps >= 1) throw new ApiError(409, "Kantor ini sudah punya VPS.");

    const token = randomToken(32);
    const dev = await one<{ id: string }>(
      tx,
      `insert into public.devices (office_id, kind, name, token_hash, public_key, connector_version, status, last_seen_at, capabilities)
       values ($1, $2, $3, $4, $5, $6, 'online', now(), $7) returning id`,
      [code.office_id, p.kind, p.name, sha256(token), p.publicKey, p.version, isPc ? ["agents", "video"] : ["agents"]],
    );
    await tx.query(`update public.setup_codes set used_at = now(), used_by_device_id = $2 where id = $1`, [code.id, dev!.id]);
    await addActivity(tx, code.office_id, "device.paired", `${p.name} tersambung ke kantor`);
    return { deviceId: dev!.id, deviceToken: token, officeSlug: office.slug, officeName: office.display_name };
  });
}

export async function heartbeat(dev: Device, body: unknown) {
  const h = HeartbeatRequest.parse(body);
  const d = await db();
  const wasOffline = await one<{ status: string }>(d, `select status from public.devices where id = $1`, [dev.id]);
  await d.query(
    `update public.devices set status = 'online', last_seen_at = now(), ai_status = $2, connector_version = $3 where id = $1`,
    [dev.id, h.aiStatus, h.version],
  );
  if (wasOffline?.status === "offline") await addActivity(d, dev.office_id, "device.online", `${dev.name} kembali online`);
  if (h.activeRunIds.length) {
    await d.query(
      `update public.task_runs set lease_expires_at = now() + interval '15 minutes'
        where device_id = $1 and id = any($2::uuid[]) and status in ('claimed','running')`,
      [dev.id, h.activeRunIds],
    );
  }
  const work = await one<{ n: number }>(
    d,
    `select count(*)::int as n from public.task_runs where office_id = $1 and status = 'queued' and required_capability = any($2::text[])`,
    [dev.office_id, dev.capabilities],
  );
  return { hasWork: (work?.n ?? 0) > 0 };
}

type RunRow = {
  id: string;
  task_id: string;
  agent_id: string;
  channel_id: string | null;
  content_id: string | null;
  trigger_source: string;
  input: Record<string, unknown>;
};

/** Ambil satu run (claim_task_run: SKIP LOCKED) lalu rakit paket kerja. */
export async function claim(dev: Device): Promise<WorkPackage | null> {
  const d = await db();
  return d.transaction(async (tx) => {
    await tx.query(`select public.enqueue_due_tasks()`);
    const run = await one<RunRow>(tx, `select id, task_id, agent_id, channel_id, content_id, trigger_source, input from public.claim_task_run($1)`, [dev.id]);
    if (!run?.id) return null;

    const t = await one<{ id: string; name: string; instructions: string; kind: WorkPackage["run"]["kind"] }>(
      tx, `select id, name, instructions, kind from public.tasks where id = $1`, [run.task_id]);
    const a = await one<{ id: string; name: string; title: string; job_description: string; brain: WorkPackage["agent"]["brain"]; model: string | null }>(
      tx, `select id, name, title, job_description, brain, model from public.agents where id = $1`, [run.agent_id]);
    const skills = await many<{ slug: string; name: string; body: string }>(
      tx,
      `select s.slug, s.name, s.body_md as body from public.agent_skills x join public.skills s on s.id = x.skill_id where x.agent_id = $1`,
      [run.agent_id],
    );
    const ch = run.channel_id
      ? await one<{ id: string; name: string; niche: string; language: string }>(
          tx, `select id, name, niche, content_language as language from public.channels where id = $1`, [run.channel_id])
      : null;

    const context: WorkPackage["context"] = {};
    if (t!.kind === "script" && ch) {
      const revisionOf = typeof run.input.content_id === "string" && run.input.revision_note ? run.input.content_id : null;
      if (revisionOf) {
        const c = await one<{ id: string; title: string; script: string }>(
          tx, `select id, title, coalesce(script, '') as script from public.contents where id = $1 and office_id = $2`, [revisionOf, dev.office_id]);
        if (c) context.revision = { contentId: c.id, title: c.title, script: c.script, note: String(run.input.revision_note) };
      } else {
        // Topik dari riset sebelumnya (rantai), atau topik terbaik yang belum dipakai di channel ini.
        const ids = Array.isArray(run.input.topic_ids) ? (run.input.topic_ids as string[]) : [];
        const topics = await many<{ id: string; title: string; angle: string | null; sources: { url: string; title: string }[] }>(
          tx,
          ids.length
            ? `select id, title, angle, sources from public.topics where office_id = $1 and id = any($2::uuid[]) order by score desc nulls last`
            : `select id, title, angle, sources from public.topics where office_id = $1 and channel_id = $2 and status = 'new' order by score desc nulls last, created_at desc limit 3`,
          ids.length ? [dev.office_id, ids] : [dev.office_id, ch.id],
        );
        context.topics = topics;
        if (topics[0]) {
          await tx.query(`update public.task_runs set input = input || $2::jsonb where id = $1`, [run.id, { chosen_topic_id: topics[0].id }]);
        }
      }
    }

    if (t!.kind === "video" && ch) {
      // Naskah dari rantai/persetujuan (content_id), atau naskah disetujui terbaru di channel ini.
      const fromRun = typeof run.input.content_id === "string" ? run.input.content_id : run.content_id;
      const c = await one<{ id: string; title: string; script: string; visual_plan: { scene: string; visual: string }[]; revision: number }>(
        tx,
        fromRun
          ? `select id, title, coalesce(script, '') as script, visual_plan, revision from public.contents where id = $2 and office_id = $1`
          : `select id, title, coalesce(script, '') as script, visual_plan, revision from public.contents
              where office_id = $1 and channel_id = $2 and stage = 'script_approved' order by updated_at desc limit 1`,
        [dev.office_id, fromRun ?? ch.id],
      );
      if (c) {
        context.content = {
          id: c.id,
          title: c.title,
          script: c.script,
          visualPlan: c.visual_plan,
          revision: c.revision,
          note: typeof run.input.revision_note === "string" ? run.input.revision_note : null,
        };
        await tx.query(`update public.contents set stage = 'rendering', failure_reason = null where id = $1`, [c.id]);
        await tx.query(`update public.task_runs set content_id = $2 where id = $1`, [run.id, c.id]);
      }
    }

    if (t!.kind === "cs_reply" && typeof run.input.conversation_id === "string") {
      const cs = await csContext(tx, dev.office_id, run.input.conversation_id);
      if (cs) context.cs = cs;
    }

    await tx.query(`update public.agents set status = 'working' where id = $1`, [run.agent_id]);
    return {
      run: { id: run.id, kind: t!.kind, triggerSource: run.trigger_source },
      agent: { id: a!.id, name: a!.name, title: a!.title, jobDescription: a!.job_description, brain: a!.brain, model: a!.model },
      task: { id: t!.id, name: t!.name, instructions: t!.instructions },
      skills,
      channel: ch,
      context,
    } satisfies WorkPackage;
  });
}

async function leasedRun(sql: Sql, dev: Device, runId: string) {
  const r = await one<RunRow & { status: string; kind: string; task_name: string; agent_name: string; office_id: string }>(
    sql,
    `select r.id, r.task_id, r.agent_id, r.channel_id, r.content_id, r.trigger_source, r.input, r.status, r.office_id,
            t.kind, t.name as task_name, a.name as agent_name
       from public.task_runs r join public.tasks t on t.id = r.task_id join public.agents a on a.id = r.agent_id
      where r.id = $1 and r.device_id = $2 for update of r`,
    [runId, dev.id],
  );
  if (!r) throw new ApiError(404, "Run tidak ditemukan untuk perangkat ini.");
  return r;
}

export async function progress(dev: Device, runId: string, body: unknown) {
  const p = ProgressRequest.parse(body);
  const d = await db();
  const r = await one<{ status: string }>(
    d,
    `update public.task_runs set status = 'running', progress_pct = coalesce($3, progress_pct), progress_message = coalesce($4, progress_message),
            lease_expires_at = now() + interval '15 minutes'
      where id = $1 and device_id = $2 and status in ('claimed','running') returning status`,
    [runId, dev.id, p.pct ?? null, p.message ?? null],
  );
  // cancel = true bila run sudah tidak milik perangkat ini (mis. dicabut / dibatalkan).
  return { cancel: !r };
}

/** Enqueue tugas-tugas yang menunggu tugas ini selesai. */
async function chainChildren(tx: Sql, officeId: string, parentRunId: string, taskId: string, input: Record<string, unknown>) {
  await tx.query(
    `insert into public.task_runs (office_id, task_id, agent_id, channel_id, content_id, parent_run_id, trigger_source, priority, required_capability, input)
     select t.office_id, t.id, t.agent_id, t.channel_id, $4::uuid, $2, 'chain', t.priority, t.required_capability, $5::jsonb
       from public.tasks t join public.agents a on a.id = t.agent_id and a.archived_at is null
      where t.office_id = $1 and t.after_task_id = $3 and t.enabled`,
    [officeId, parentRunId, taskId, (input.content_id as string) ?? null, input],
  );
}

export async function complete(dev: Device, runId: string, body: unknown) {
  const c = CompleteRequest.parse(body);
  const d = await db();
  let toDeliver: string | null = null;
  const result = await d.transaction(async (tx) => {
    const run = await leasedRun(tx, dev, runId);
    if (run.status === "succeeded" || run.status === "failed") return { ok: true, duplicate: true }; // kiriman ulang
    if (run.status !== "claimed" && run.status !== "running") throw new ApiError(409, `Run berstatus ${run.status}.`);

    const finish = async (status: "succeeded" | "failed", resultMd: string | null, output: unknown, error: string | null) => {
      await tx.query(
        `update public.task_runs set status = $2, result_md = $3, output = $4, error = $5, finished_at = now(), lease_expires_at = null,
                cost_usd_micros = $6, input_tokens = $7, output_tokens = $8, progress_pct = case when $2 = 'succeeded' then 100 else progress_pct end
          where id = $1`,
        [run.id, status, resultMd, output === undefined ? null : output, error, c.costUsdMicros, c.inputTokens, c.outputTokens],
      );
    };
    const fail = async (msg: string) => {
      await finish("failed", null, c.output, msg);
      if (run.kind === "video" && run.content_id) {
        // Render gagal: naskah kembali siap dirender, alasan disimpan untuk ditampilkan.
        await tx.query(
          `update public.contents set stage = 'script_approved', failure_reason = $2 where id = $1 and stage = 'rendering'`,
          [run.content_id, msg.slice(0, 500)],
        );
      }
      await tx.query(`update public.agents set status = 'error' where id = $1`, [run.agent_id]);
      await addActivity(tx, run.office_id, "run.failed", `gagal menjalankan "${run.task_name}": ${msg.slice(0, 160)}`, run.agent_id);
      return { ok: true };
    };

    if (c.status === "failed") return fail(c.error ?? "Kesalahan tidak diketahui");

    const channel = run.channel_id
      ? await one<{ id: string; name: string; mode: "manual" | "auto" }>(tx, `select id, name, mode from public.channels where id = $1`, [run.channel_id])
      : null;

    if (run.kind === "research") {
      const out = ResearchOutput.safeParse(c.output);
      if (!out.success || !channel) return fail(`Hasil riset tidak sesuai format: ${out.error?.issues[0]?.message ?? "channel hilang"}`);
      const ids: string[] = [];
      for (const tp of out.data.topics) {
        const r = await one<{ id: string }>(
          tx,
          `insert into public.topics (office_id, channel_id, run_id, title, angle, sources, score) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [run.office_id, channel.id, run.id, tp.title, tp.angle, tp.sources, tp.score],
        );
        ids.push(r!.id);
      }
      await finish("succeeded", null, out.data, null);
      await tx.query(`update public.agents set status = 'idle' where id = $1`, [run.agent_id]);
      await addActivity(tx, run.office_id, "run.succeeded", `menemukan ${ids.length} topik untuk ${channel.name}`, run.agent_id);
      await chainChildren(tx, run.office_id, run.id, run.task_id, { topic_ids: ids });
      return { ok: true };
    }

    if (run.kind === "script") {
      const out = ScriptOutput.safeParse(c.output);
      if (!out.success || !channel) return fail(`Naskah tidak sesuai format: ${out.error?.issues[0]?.message ?? "channel hilang"}`);
      const words = countWords(out.data.script);
      const duration = Math.round(words / WORDS_PER_SECOND);
      const manual = channel.mode === "manual";
      const stage = manual ? "script_review" : "script_approved";
      const revisionOf = typeof run.input.content_id === "string" && run.input.revision_note ? (run.input.content_id as string) : null;

      let contentId: string;
      let revision = 0;
      if (revisionOf) {
        const r = await one<{ id: string; revision: number }>(
          tx,
          `update public.contents set title = $3, script = $4, visual_plan = $5, word_count = $6, duration_s = $7, stage = $8
            where id = $1 and office_id = $2 returning id, revision`,
          [revisionOf, run.office_id, out.data.title, out.data.script, out.data.visual_plan, words, duration, stage],
        );
        if (!r) return fail("Konten yang direvisi tidak ditemukan.");
        contentId = r.id;
        revision = r.revision;
      } else {
        const topicId = typeof run.input.chosen_topic_id === "string" ? run.input.chosen_topic_id : null;
        const r = await one<{ id: string }>(
          tx,
          `insert into public.contents (office_id, channel_id, topic_id, title, script, visual_plan, word_count, duration_s, stage)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
          [run.office_id, channel.id, topicId, out.data.title, out.data.script, out.data.visual_plan, words, duration, stage],
        );
        contentId = r!.id;
        if (topicId) await tx.query(`update public.topics set status = 'picked' where id = $1`, [topicId]);
      }
      await tx.query(`update public.task_runs set content_id = $2 where id = $1`, [run.id, contentId]);
      await finish("succeeded", null, out.data, null);

      if (manual) {
        await tx.query(
          `insert into public.approvals (office_id, content_id, stage, revision, source_run_id) values ($1, $2, 'script', $3, $4)`,
          [run.office_id, contentId, revision, run.id],
        );
        await tx.query(`update public.agents set status = 'waiting_user' where id = $1`, [run.agent_id]);
        await addActivity(tx, run.office_id, "approval.requested",
          `${revision ? "mengirim revisi" : "mengajukan naskah"} "${out.data.title}" untuk disetujui`, run.agent_id, { type: "content", id: contentId });
      } else {
        await tx.query(`update public.agents set status = 'idle' where id = $1`, [run.agent_id]);
        await addActivity(tx, run.office_id, "run.succeeded", `menyelesaikan naskah "${out.data.title}"`, run.agent_id, { type: "content", id: contentId });
        await chainChildren(tx, run.office_id, run.id, run.task_id, { content_id: contentId });
      }
      return { ok: true };
    }

    if (run.kind === "video") {
      const out = VideoOutput.safeParse(c.output);
      if (!out.success || !channel || !run.content_id) return fail(`Hasil video tidak sesuai format: ${out.error?.issues[0]?.message ?? "naskah hilang"}`);
      const manual = channel.mode === "manual";
      const ct = await one<{ title: string; revision: number }>(
        tx,
        `update public.contents set stage = $3, device_id = $4, video_local_ref = $5, duration_s = $6, failure_reason = null
          where id = $1 and office_id = $2 returning title, revision`,
        [run.content_id, run.office_id, manual ? "video_review" : "video_approved", dev.id, out.data.local_ref, out.data.duration_s],
      );
      if (!ct) return fail("Konten untuk video ini tidak ditemukan.");
      await finish("succeeded", null, out.data, null);
      if (manual) {
        await tx.query(
          `insert into public.approvals (office_id, content_id, stage, revision, source_run_id) values ($1, $2, 'video', $3, $4)`,
          [run.office_id, run.content_id, ct.revision, run.id],
        );
        await tx.query(`update public.agents set status = 'waiting_user' where id = $1`, [run.agent_id]);
        await addActivity(tx, run.office_id, "approval.requested", `mengajukan video "${ct.title}" untuk disetujui`, run.agent_id, { type: "content", id: run.content_id });
      } else {
        await tx.query(`update public.agents set status = 'idle' where id = $1`, [run.agent_id]);
        await addActivity(tx, run.office_id, "run.succeeded", `selesai merender video "${ct.title}"`, run.agent_id, { type: "content", id: run.content_id });
        await chainChildren(tx, run.office_id, run.id, run.task_id, { content_id: run.content_id });
      }
      return { ok: true };
    }

    if (run.kind === "cs_reply") {
      const out = CsReplyOutput.safeParse(c.output);
      const convId = typeof run.input.conversation_id === "string" ? run.input.conversation_id : null;
      if (!out.success || !convId) return fail(`Balasan CS tidak sesuai format: ${out.error?.issues[0]?.message ?? "percakapan hilang"}`);
      // Pemilik sudah mengambil alih selagi agent menulis: balasan agent tidak dikirim.
      const conv = await one<{ handled_by: string }>(tx, `select handled_by from public.cs_conversations where id = $1 and office_id = $2`, [convId, run.office_id]);
      await finish("succeeded", null, out.data, null);
      await tx.query(`update public.agents set status = 'idle' where id = $1`, [run.agent_id]);
      if (conv?.handled_by === "agent") {
        toDeliver = await recordAgentReply(tx, run.office_id, convId, run.id, out.data.reply, out.data.handoff, run.agent_id);
      }
      return { ok: true };
    }

    // general (dan jenis lain di fase berikutnya): ringkasan markdown.
    const out = GeneralOutput.safeParse(c.output);
    if (!out.success) return fail(`Hasil tugas tidak sesuai format: ${z.prettifyError(out.error).slice(0, 200)}`);
    await finish("succeeded", out.data.summary_md, out.data, null);
    await tx.query(`update public.agents set status = 'idle' where id = $1`, [run.agent_id]);
    await addActivity(tx, run.office_id, "run.succeeded", `menyelesaikan "${run.task_name}"`, run.agent_id);
    await chainChildren(tx, run.office_id, run.id, run.task_id, {});
    return { ok: true };
  });
  // Kirim balasan CS setelah transaksi selesai (panggilan jaringan tidak boleh menahan transaksi).
  if (toDeliver) await deliver(toDeliver);
  return result;
}

/**
 * Cover kecil (JPEG <= 200 KB) dari konektor. Hanya untuk konten yang sedang/pernah dirender perangkat ini.
 * Disimpan di bucket privat `covers`; dashboard membacanya lewat signed URL.
 */
export async function uploadCover(dev: Device, contentId: string, req: Request) {
  if (!/^[0-9a-f-]{36}$/i.test(contentId)) throw new ApiError(404, "Konten tidak ditemukan.");
  if (req.headers.get("content-type") !== "image/jpeg") throw new ApiError(415, "Cover harus JPEG.");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > COVER_MAX_BYTES) throw new ApiError(413, "Cover terlalu besar (maks 200 KB).");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > COVER_MAX_BYTES) throw new ApiError(413, "Cover terlalu besar (maks 200 KB).");
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new ApiError(415, "Isi file bukan JPEG.");

  const d = await db();
  const own = await one<{ office_id: string }>(
    d,
    `select c.office_id from public.contents c
      where c.id = $1 and c.office_id = $2
        and exists (select 1 from public.task_runs r where r.content_id = c.id and r.device_id = $3)`,
    [contentId, dev.office_id, dev.id],
  );
  if (!own) throw new ApiError(404, "Konten tidak ditemukan untuk perangkat ini.");
  const path = `${dev.office_id}/${contentId}.jpg`;
  const { error } = await supabaseAdmin().storage.from("covers").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Gagal menyimpan cover: ${error.message}`);
  await d.query(`update public.contents set cover_path = $2 where id = $1`, [contentId, path]);
  return { ok: true };
}

/** Bungkus route handler: JSON masuk/keluar, error jadi status HTTP yang jelas. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const out = await fn();
    if (out === null) return new Response(null, { status: 204 });
    return Response.json(out);
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError) return Response.json({ error: "Data tidak valid", issues: e.issues }, { status: 400 });
    console.error("[device api]", e);
    return Response.json({ error: "Kesalahan server" }, { status: 500 });
  }
}
