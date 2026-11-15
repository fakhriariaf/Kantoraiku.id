import "server-only";
import { z } from "zod";
import "./zod-id";
import { BRAINS } from "@kantoraiku/shared";
import { db, many, one, type Sql } from "./db";
import { humanCode, sha256 } from "./crypto";
import { supabaseAdmin } from "./supabase";

// Semua fungsi menerima officeId yang sudah dicek lewat requireMember(): cek di data layer.

export type AgentRow = {
  id: string;
  name: string;
  title: string;
  job_description: string;
  color: string;
  kind: "custom" | "assistant";
  brain: (typeof BRAINS)[number];
  model: string | null;
  status: "idle" | "working" | "waiting_user" | "error";
  desk_index: number | null;
  appearance: string | null;
  archived_at: string | null;
  created_at: string;
};

export type ChannelRow = {
  id: string;
  name: string;
  niche: string;
  content_language: string;
  mode: "manual" | "auto";
  post_times: string[];
  created_at: string;
};

export type TaskRow = {
  id: string;
  name: string;
  instructions: string;
  kind: "general" | "research" | "script" | "video";
  trigger: "schedule" | "after_task" | "manual";
  schedule_times: string[];
  schedule_days: number[];
  after_task_id: string | null;
  after_task_name: string | null;
  priority: number;
  enabled: boolean;
  next_run_at: string | null;
  agent_id: string;
  agent_name: string;
  channel_id: string | null;
  channel_name: string | null;
  last_status: string | null;
  last_finished_at: string | null;
};

export type FeedRow = { id: string; agent_id: string | null; agent_name: string | null; agent_title: string | null; text: string; created_at: string };

export async function addActivity(sql: Sql, officeId: string, kind: string, text: string, agentId: string | null = null, object?: { type: string; id: string }) {
  await sql.query(
    `insert into public.activity_events (office_id, agent_id, kind, text, object_type, object_id) values ($1, $2, $3, $4, $5, $6)`,
    [officeId, agentId, kind, text, object?.type ?? null, object?.id ?? null],
  );
}

// ---------------------------------------------------------------------------
// Ringkasan kantor + feed
// ---------------------------------------------------------------------------

export async function officeOverview(officeId: string) {
  const d = await db();
  const [counts, feed, agents] = await Promise.all([
    one<{ waiting: number; online: number; devices: number; queued: number }>(
      d,
      `select
         (select count(*)::int from public.approvals where office_id = $1 and decision is null) as waiting,
         (select count(*)::int from public.devices where office_id = $1 and status = 'online') as online,
         (select count(*)::int from public.devices where office_id = $1 and status <> 'revoked') as devices,
         (select count(*)::int from public.task_runs where office_id = $1 and status = 'queued') as queued`,
      [officeId],
    ),
    listFeed(officeId, 20),
    listAgents(officeId),
  ]);
  return { counts: counts!, feed, agents };
}

export type AgentActivity = { agent_id: string; kind: "run" | "approval"; label: string; progress_pct: number | null };

/** Apa yang sedang dikerjakan atau ditunggu tiap agent, untuk gelembung di denah kantor. */
export async function agentActivity(officeId: string) {
  const d = await db();
  const [runs, approvals] = await Promise.all([
    many<AgentActivity>(
      d,
      `select distinct on (r.agent_id) r.agent_id, 'run' as kind, coalesce(nullif(r.progress_message, ''), t.name) as label, r.progress_pct
         from public.task_runs r join public.tasks t on t.id = r.task_id
        where r.office_id = $1 and r.status in ('claimed','running')
        order by r.agent_id, r.started_at desc nulls last`,
      [officeId],
    ),
    many<AgentActivity>(
      d,
      `select distinct on (r.agent_id) r.agent_id, 'approval' as kind, c.title as label, null::int as progress_pct
         from public.approvals ap
         join public.task_runs r on r.id = ap.source_run_id
         join public.contents c on c.id = ap.content_id
        where ap.office_id = $1 and ap.decision is null
        order by r.agent_id, ap.created_at desc`,
      [officeId],
    ),
  ]);
  return new Map([...runs, ...approvals].map((a) => [a.agent_id, a]));
}

export async function listFeed(officeId: string, limit = 50) {
  return many<FeedRow>(
    await db(),
    `select e.id, e.agent_id, a.name as agent_name, a.title as agent_title, e.text, e.created_at
       from public.activity_events e left join public.agents a on a.id = e.agent_id
      where e.office_id = $1 order by e.created_at desc limit $2`,
    [officeId, limit],
  );
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const AgentInput = z.object({
  name: z.string().trim().min(1, "Isi nama agent.").max(40, "Maksimal 40 karakter."),
  title: z.string().trim().min(1, "Isi jabatan.").max(60, "Maksimal 60 karakter."),
  job_description: z.string().trim().max(8000, "Job desk terlalu panjang (maks 8.000 karakter)."),
  brain: z.enum(BRAINS),
  model: z.string().trim().max(80, "Nama model maksimal 80 karakter.").optional().transform((v) => v || null),
  /** Kosong = karakter dipilihkan otomatis dari id agent. */
  appearance: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^c(0[1-9]|1[0-2])$/.test(v), "Pilih salah satu karakter."),
});

export async function listAgents(officeId: string) {
  return many<AgentRow & { skills: string[] }>(
    await db(),
    `select a.*,
            coalesce((select array_agg(s.name order by s.name) from public.agent_skills x join public.skills s on s.id = x.skill_id where x.agent_id = a.id), '{}') as skills
       from public.agents a
      where a.office_id = $1 and a.archived_at is null
      order by a.kind = 'assistant', a.created_at`,
    [officeId],
  );
}

export async function getAgent(officeId: string, id: string) {
  return one<AgentRow>(await db(), `select * from public.agents where office_id = $1 and id = $2`, [officeId, id]);
}

function uniqueViolation(e: unknown, index: string) {
  return String(e).includes(index);
}

export async function createAgent(officeId: string, input: z.infer<typeof AgentInput>) {
  try {
    const r = await one<{ id: string }>(
      await db(),
      `insert into public.agents (office_id, name, title, job_description, brain, model, appearance,
         desk_index) values ($1, $2, $3, $4, $5, $6, $7,
         (select coalesce(max(desk_index), 0) + 1 from public.agents where office_id = $1)) returning id`,
      [officeId, input.name, input.title, input.job_description, input.brain, input.model, input.appearance],
    );
    return { id: r!.id };
  } catch (e) {
    if (uniqueViolation(e, "agents_office_name")) return { error: "Sudah ada agent dengan nama ini." };
    throw e;
  }
}

export async function updateAgent(officeId: string, id: string, input: z.infer<typeof AgentInput>) {
  try {
    await (await db()).query(
      `update public.agents set name = $3, title = $4, job_description = $5, brain = $6, model = $7, appearance = $8
        where office_id = $1 and id = $2 and kind = 'custom'`,
      [officeId, id, input.name, input.title, input.job_description, input.brain, input.model, input.appearance],
    );
    return { id };
  } catch (e) {
    if (uniqueViolation(e, "agents_office_name")) return { error: "Sudah ada agent dengan nama ini." };
    throw e;
  }
}

export async function archiveAgent(officeId: string, id: string) {
  const d = await db();
  await d.transaction(async (tx) => {
    await tx.query(`update public.agents set archived_at = now() where office_id = $1 and id = $2 and kind = 'custom'`, [officeId, id]);
    await tx.query(
      `update public.task_runs set status = 'cancelled', finished_at = now(), error = 'Agent diarsipkan'
        where office_id = $1 and agent_id = $2 and status = 'queued'`,
      [officeId, id],
    );
    await tx.query(`update public.tasks set enabled = false where office_id = $1 and agent_id = $2`, [officeId, id]);
  });
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export const ChannelInput = z.object({
  name: z.string().trim().min(1, "Isi nama channel.").max(80, "Nama channel maksimal 80 karakter."),
  niche: z.string().trim().max(2000, "Niche maksimal 2.000 karakter."),
  content_language: z.enum(["id", "en"]),
  mode: z.enum(["manual", "auto"]),
  /** Jam posting lokal kantor ("16:00"). Kosong = video disetujui tidak dijadwalkan otomatis. */
  post_times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam tidak valid."))
    .max(4, "Maksimal 4 jam posting.")
    .default([])
    .transform((t) => [...new Set(t)].sort()),
});

export async function listChannels(officeId: string) {
  return many<ChannelRow & { contents: number }>(
    await db(),
    `select c.id, c.name, c.niche, c.content_language, c.mode, c.created_at,
            array(select to_char(t, 'HH24:MI') from unnest(c.post_times) t order by t) as post_times,
            (select count(*)::int from public.contents x where x.channel_id = c.id) as contents
       from public.channels c where c.office_id = $1 and c.archived_at is null order by c.created_at`,
    [officeId],
  );
}

export async function createChannel(officeId: string, input: z.infer<typeof ChannelInput>) {
  const r = await one<{ id: string }>(
    await db(),
    `insert into public.channels (office_id, name, niche, content_language, mode, post_times) values ($1, $2, $3, $4, $5, $6::time[]) returning id`,
    [officeId, input.name, input.niche, input.content_language, input.mode, input.post_times],
  );
  return r!.id;
}

export async function getChannel(officeId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one<ChannelRow>(
    await db(),
    `select c.id, c.name, c.niche, c.content_language, c.mode, c.created_at,
            array(select to_char(t, 'HH24:MI') from unnest(c.post_times) t order by t) as post_times
       from public.channels c where c.office_id = $1 and c.id = $2 and c.archived_at is null`,
    [officeId, id],
  );
}

export async function updateChannel(officeId: string, id: string, input: z.infer<typeof ChannelInput>) {
  await (await db()).query(
    `update public.channels set name = $3, niche = $4, content_language = $5, post_times = $6::time[]
      where office_id = $1 and id = $2 and archived_at is null`,
    [officeId, id, input.name, input.niche, input.content_language, input.post_times],
  );
}

export async function setChannelMode(officeId: string, id: string, mode: "manual" | "auto") {
  await (await db()).query(
    `update public.channels set mode = $3, consecutive_failures = 0, auto_paused_reason = null where office_id = $1 and id = $2`,
    [officeId, id, mode],
  );
}

// ---------------------------------------------------------------------------
// Tugas dan run
// ---------------------------------------------------------------------------

export const TaskInput = z
  .object({
    name: z.string().trim().min(1, "Isi nama tugas.").max(80, "Nama tugas maksimal 80 karakter."),
    agent_id: z.uuid("Pilih agent."),
    channel_id: z.uuid().optional().or(z.literal("")).transform((v) => v || null),
    kind: z.enum(["general", "research", "script", "video"]),
    instructions: z.string().trim().max(8000, "Instruksi maksimal 8.000 karakter."),
    trigger: z.enum(["manual", "after_task", "schedule"]),
    after_task_id: z.uuid().optional().or(z.literal("")).transform((v) => v || null),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    days: z.array(z.coerce.number().int().min(1).max(7)).default([]),
    priority: z.coerce.number().int().min(0).max(2).default(1),
  })
  .superRefine((t, ctx) => {
    if (t.kind !== "general" && !t.channel_id) ctx.addIssue({ code: "custom", path: ["channel_id"], message: "Tugas riset, naskah, dan video butuh channel." });
    if (t.trigger === "after_task" && !t.after_task_id) ctx.addIssue({ code: "custom", path: ["after_task_id"], message: "Pilih tugas yang ditunggu." });
    if (t.trigger === "schedule" && !t.time) ctx.addIssue({ code: "custom", path: ["time"], message: "Isi jam." });
    if (t.trigger === "schedule" && t.days.length === 0) ctx.addIssue({ code: "custom", path: ["days"], message: "Pilih minimal satu hari." });
  });

export async function listTasks(officeId: string) {
  return many<TaskRow>(
    await db(),
    `select t.id, t.name, t.instructions, t.kind, t.trigger, t.schedule_times::text[] as schedule_times, t.schedule_days::int[] as schedule_days,
            t.after_task_id, p.name as after_task_name, t.priority, t.enabled, t.next_run_at,
            t.agent_id, a.name as agent_name, t.channel_id, c.name as channel_name,
            r.status as last_status, r.finished_at as last_finished_at
       from public.tasks t
       join public.agents a on a.id = t.agent_id
       left join public.channels c on c.id = t.channel_id
       left join public.tasks p on p.id = t.after_task_id
       left join lateral (select status, finished_at from public.task_runs where task_id = t.id order by created_at desc limit 1) r on true
      where t.office_id = $1 and a.archived_at is null
      order by t.created_at`,
    [officeId],
  );
}

export async function createTask(officeId: string, t: z.infer<typeof TaskInput>) {
  try {
    const r = await one<{ id: string }>(
      await db(),
      `insert into public.tasks (office_id, agent_id, channel_id, name, kind, instructions, trigger, after_task_id,
         schedule_times, schedule_days, priority, required_capability)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::time[], $10::smallint[], $11, $12) returning id`,
      [
        officeId, t.agent_id, t.channel_id, t.name, t.kind, t.instructions, t.trigger,
        t.trigger === "after_task" ? t.after_task_id : null,
        t.trigger === "schedule" && t.time ? [t.time] : [],
        t.trigger === "schedule" ? t.days : [1, 2, 3, 4, 5, 6, 7],
        t.priority,
        t.kind === "video" ? "video" : "agents", // render hanya di PC (VPS tidak punya kemampuan video)
      ],
    );
    return { id: r!.id };
  } catch (e) {
    const s = String(e);
    if (s.includes("melingkar")) return { error: "Rantai tugas tidak boleh melingkar." };
    if (s.includes("foreign key")) return { error: "Agent, channel, atau tugas sumber tidak ditemukan di kantor ini." };
    throw e;
  }
}

export async function setTaskEnabled(officeId: string, id: string, enabled: boolean) {
  await (await db()).query(`update public.tasks set enabled = $3 where office_id = $1 and id = $2`, [officeId, id, enabled]);
}

export async function deleteTask(officeId: string, id: string) {
  await (await db()).query(`delete from public.tasks where office_id = $1 and id = $2`, [officeId, id]);
}

/** Jalankan sekarang: run manual, agent/channel disalin dari tugas (bukan dari input user). */
export async function runTaskNow(officeId: string, taskId: string) {
  const r = await one<{ id: string }>(
    await db(),
    `insert into public.task_runs (office_id, task_id, agent_id, channel_id, trigger_source, priority, required_capability)
     select office_id, id, agent_id, channel_id, 'manual', greatest(priority, 1::smallint), required_capability
       from public.tasks where office_id = $1 and id = $2
     returning id`,
    [officeId, taskId],
  );
  return r?.id ?? null;
}

export async function listRuns(officeId: string, limit = 30) {
  return many<{
    id: string;
    status: string;
    trigger_source: string;
    task_name: string;
    agent_name: string;
    error: string | null;
    skipped_reason: string | null;
    progress_message: string | null;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
    finished_at: string | null;
  }>(
    await db(),
    `select r.id, r.status, r.trigger_source, t.name as task_name, a.name as agent_name, r.error, r.skipped_reason,
            r.progress_message, r.input_tokens, r.output_tokens, r.created_at, r.finished_at
       from public.task_runs r join public.tasks t on t.id = r.task_id join public.agents a on a.id = r.agent_id
      where r.office_id = $1 order by r.created_at desc limit $2`,
    [officeId, limit],
  );
}

// ---------------------------------------------------------------------------
// Konten dan persetujuan
// ---------------------------------------------------------------------------

export type ApprovalItem = {
  approval_id: string;
  stage: "script" | "video";
  revision: number;
  content_id: string;
  title: string;
  channel_name: string;
  agent_name: string | null;
  agent_id: string | null;
  word_count: number | null;
  duration_s: number | null;
  created_at: string;
};

export async function listPendingApprovals(officeId: string) {
  return many<ApprovalItem>(
    await db(),
    `select ap.id as approval_id, ap.stage, ap.revision, c.id as content_id, c.title, ch.name as channel_name,
            a.name as agent_name, a.id as agent_id, c.word_count, c.duration_s, ap.created_at
       from public.approvals ap
       join public.contents c on c.id = ap.content_id
       join public.channels ch on ch.id = c.channel_id
       left join public.task_runs r on r.id = ap.source_run_id
       left join public.agents a on a.id = r.agent_id
      where ap.office_id = $1 and ap.decision is null
      order by ap.created_at`,
    [officeId],
  );
}

export async function getContent(officeId: string, id: string) {
  const d = await db();
  const c = await one<{
    id: string;
    title: string;
    script: string | null;
    visual_plan: { scene: string; visual: string }[];
    word_count: number | null;
    duration_s: number | null;
    stage: string;
    revision: number;
    created_at: string;
    channel_name: string;
    channel_mode: string;
    topic_title: string | null;
    topic_angle: string | null;
    topic_sources: { url: string; title: string }[] | null;
    cover_path: string | null;
    video_local_ref: string | null;
    device_name: string | null;
    failure_reason: string | null;
    scheduled_at: string | null;
    published_at: string | null;
    video: { voice: "elevenlabs" | "simulation"; footage: { url: string; author: string; author_url: string }[] } | null;
  }>(
    d,
    `select c.id, c.title, c.script, c.visual_plan, c.word_count, c.duration_s, c.stage, c.revision, c.created_at,
            ch.name as channel_name, ch.mode as channel_mode, t.title as topic_title, t.angle as topic_angle, t.sources as topic_sources,
            c.cover_path, c.video_local_ref, dv.name as device_name, c.failure_reason, c.scheduled_at, c.published_at,
            (select r.output from public.task_runs r join public.tasks tk on tk.id = r.task_id
              where r.content_id = c.id and tk.kind = 'video' and r.status = 'succeeded' order by r.finished_at desc limit 1) as video
       from public.contents c join public.channels ch on ch.id = c.channel_id
       left join public.topics t on t.id = c.topic_id
       left join public.devices dv on dv.id = c.device_id
      where c.office_id = $1 and c.id = $2`,
    [officeId, id],
  );
  if (!c) return null;
  const approvals = await many<{
    id: string;
    stage: string;
    revision: number;
    decision: string | null;
    note: string | null;
    decided_at: string | null;
    decided_by_email: string | null;
    agent_name: string | null;
    created_at: string;
  }>(
    d,
    `select ap.id, ap.stage, ap.revision, ap.decision, ap.note, ap.decided_at, u.email as decided_by_email, a.name as agent_name, ap.created_at
       from public.approvals ap left join auth.users u on u.id = ap.decided_by
       left join public.task_runs r on r.id = ap.source_run_id left join public.agents a on a.id = r.agent_id
      where ap.content_id = $1 order by ap.created_at desc`,
    [id],
  );
  // Cover ada di bucket privat: tautan bertanda tangan, berlaku 1 jam.
  let coverUrl: string | null = null;
  if (c.cover_path) {
    const { data } = await supabaseAdmin().storage.from("covers").createSignedUrl(c.cover_path, 3600);
    coverUrl = data?.signedUrl ?? null;
  }
  return { ...c, approvals, coverUrl };
}

export async function listContents(officeId: string, limit = 30) {
  return many<{ id: string; title: string; stage: string; channel_name: string; revision: number; created_at: string }>(
    await db(),
    `select c.id, c.title, c.stage, ch.name as channel_name, c.revision, c.created_at
       from public.contents c join public.channels ch on ch.id = c.channel_id
      where c.office_id = $1 order by c.created_at desc limit $2`,
    [officeId, limit],
  );
}

/** Setujui / Revisi / Tolak lewat decide_approval() (atomik, cek keanggotaan di SQL). */
export async function decide(officeId: string, userId: string, approvalId: string, decision: "approve" | "revise" | "reject", note: string | null) {
  const d = await db();
  if (decision === "revise" && !note?.trim()) return { error: "Catatan revisi wajib diisi." };
  return d.transaction(async (tx) => {
    // Kunci baris dulu lalu cek di sini: error SQL di dalam transaksi menggagalkan seluruh transaksi
    // (postgres v4), jadi kasus "sudah diputuskan" tidak boleh mengandalkan exception dari decide_approval.
    const ap = await one<{ content_id: string; stage: string; source_run_id: string | null; title: string; decided: boolean }>(
      tx,
      `select ap.content_id, ap.stage, ap.source_run_id, c.title, ap.decision is not null as decided
         from public.approvals ap join public.contents c on c.id = ap.content_id
        where ap.id = $1 and ap.office_id = $2
        for update of ap`,
      [approvalId, officeId],
    );
    if (!ap) return { error: "Persetujuan tidak ditemukan." };
    if (ap.decided) return { error: "Sudah diputuskan sebelumnya." };
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.query(`select public.decide_approval($1, $2, $3)`, [approvalId, decision, note]);
    // Agent penulis tidak lagi "menunggu kamu" bila tidak ada review lain miliknya.
    await tx.query(
      `update public.agents a set status = 'idle'
        where a.id = (select agent_id from public.task_runs where id = $1) and a.status = 'waiting_user'
          and not exists (select 1 from public.approvals ap join public.task_runs r on r.id = ap.source_run_id
                           where ap.decision is null and r.agent_id = a.id)`,
      [ap.source_run_id],
    );
    const verb = { approve: "menyetujui", revise: "meminta revisi", reject: "menolak" }[decision];
    await addActivity(tx, officeId, `approval.${decision}`, `Kamu ${verb} naskah "${ap.title}"`, null, { type: "content", id: ap.content_id });
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Perangkat
// ---------------------------------------------------------------------------

export async function listDevices(officeId: string) {
  return many<{ id: string; kind: string; name: string; status: string; last_seen_at: string | null; ai_status: Record<string, string>; connector_version: string | null; created_at: string }>(
    await db(),
    `select id, kind, name, status, last_seen_at, ai_status, connector_version, created_at
       from public.devices where office_id = $1 and status <> 'revoked' order by created_at`,
    [officeId],
  );
}

/** Kode setup 8 karakter, berlaku 1 jam, sekali pakai. Hanya hash yang disimpan. */
export async function createSetupCode(officeId: string, userId: string) {
  const code = humanCode(8);
  const r = await one<{ expires_at: string }>(
    await db(),
    `insert into public.setup_codes (office_id, code_hash, expires_at, created_by)
     values ($1, $2, now() + interval '1 hour', $3) returning expires_at`,
    [officeId, sha256(code), userId],
  );
  return { code, expiresAt: r!.expires_at };
}

export async function revokeDevice(officeId: string, deviceId: string) {
  const d = await db();
  await d.transaction(async (tx) => {
    const dev = await one<{ name: string }>(
      tx,
      `update public.devices set status = 'revoked', revoked_at = now() where office_id = $1 and id = $2 and status <> 'revoked' returning name`,
      [officeId, deviceId],
    );
    if (!dev) return;
    await tx.query(
      `update public.task_runs set status = 'queued', device_id = null, lease_expires_at = null
        where office_id = $1 and device_id = $2 and status in ('claimed','running')`,
      [officeId, deviceId],
    );
    await tx.query(`delete from public.device_secrets where device_id = $1`, [deviceId]);
    await addActivity(tx, officeId, "device.revoked", `${dev.name} dicabut dari kantor`);
  });
}

// ---------------------------------------------------------------------------
// Jadwal terbit (S24)
// ---------------------------------------------------------------------------

export type ScheduleItem = {
  id: string;
  title: string;
  stage: "video_approved" | "scheduled" | "published";
  channel_id: string;
  channel_name: string;
  scheduled_at: string | null;
  published_at: string | null;
  duration_s: number | null;
  publish_results: { provider: string; url: string | null; at: string }[];
};

/** Video yang siap diposting, terjadwal, dan yang terbit 14 hari terakhir. */
export async function listSchedule(officeId: string) {
  return many<ScheduleItem>(
    await db(),
    `select c.id, c.title, c.stage, c.channel_id, ch.name as channel_name, c.scheduled_at, c.published_at, c.duration_s, c.publish_results
       from public.contents c join public.channels ch on ch.id = c.channel_id
      where c.office_id = $1
        and (c.stage in ('video_approved', 'scheduled') or (c.stage = 'published' and c.published_at > now() - interval '14 days'))
      order by c.stage = 'published', coalesce(c.scheduled_at, c.updated_at), c.published_at desc`,
    [officeId],
  );
}

/**
 * Tandai video sudah diposting (manual, sampai posting otomatis lewat Repliz tersedia).
 * Hanya dari tahap video disetujui atau terjadwal; dua klik bersamaan -> satu yang tercatat.
 */
export async function markPublished(officeId: string, contentId: string, url: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(contentId)) return { error: "Konten tidak ditemukan." };
  const d = await db();
  const r = await one<{ title: string }>(
    d,
    `update public.contents
        set stage = 'published', published_at = now(),
            publish_results = publish_results || jsonb_build_array(jsonb_build_object('provider', 'manual', 'url', $3::text, 'at', now()))
      where office_id = $1 and id = $2 and stage in ('video_approved', 'scheduled')
      returning title`,
    [officeId, contentId, url],
  );
  if (!r) return { error: "Konten ini tidak sedang menunggu diposting." };
  await addActivity(d, officeId, "content.published", `"${r.title}" sudah diposting`, null, { type: "content", id: contentId });
  return { ok: true as const };
}
