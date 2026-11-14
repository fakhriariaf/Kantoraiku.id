// Uji level database di Supabase lokal (tanpa browser): jadwal, mode hemat, lease, rantai, RLS.
import { test, expect } from "@playwright/test";
import { addContentSetup, createOffice, queueRun, sql } from "./helpers";

async function device(officeId: string) {
  const [d] = await sql`insert into public.devices (office_id, kind, name, token_hash, public_key, status, last_seen_at)
    values (${officeId}, 'pc_windows', 'PC DB', ${"h" + Math.random()}, 'pk', 'online', now()) returning id`;
  return d.id as string;
}

test("F07-E2 tugas terjadwal jatuh tempo -> satu run, tidak dobel", async () => {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId);
  await sql`update public.tasks set trigger = 'schedule', schedule_times = '{06:00}' where id = ${s.researchTaskId}`;
  await sql`update public.tasks set next_run_at = now() - interval '1 minute' where id = ${s.researchTaskId}`;
  await sql`select public.enqueue_due_tasks()`;
  await sql`select public.enqueue_due_tasks()`;
  const runs = await sql`select trigger_source from public.task_runs where task_id = ${s.researchTaskId}`;
  expect(runs.map((r) => r.trigger_source)).toEqual(["schedule"]);
  const [t] = await sql`select next_run_at > now() as future from public.tasks where id = ${s.researchTaskId}`;
  expect(t.future).toBe(true);
});

test("F03-E8 mode hemat melewati tugas prioritas rendah", async () => {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId);
  const dev = await device(f.officeId);
  await sql`update public.offices set saver_mode = 'on' where id = ${f.officeId}`;
  await sql`update public.tasks set priority = 0 where id = ${s.researchTaskId}`;
  const [r] = await sql`insert into public.task_runs (office_id, task_id, agent_id, channel_id, trigger_source, priority)
    values (${f.officeId}, ${s.researchTaskId}, ${s.researcherId}, ${s.channelId}, 'manual', 0) returning id`;
  const claimed = await sql`select id from public.claim_task_run(${dev})`;
  expect(claimed).toHaveLength(0);
  const [after] = await sql`select status, skipped_reason from public.task_runs where id = ${r.id}`;
  expect(after.status).toBe("skipped");
});

test("F03-E2 lease habis (PC mati di tengah jalan) -> run kembali antre", async () => {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId);
  const dev = await device(f.officeId);
  const runId = await queueRun(f.officeId, s.researchTaskId);
  await sql`select * from public.claim_task_run(${dev})`;
  await sql`update public.task_runs set lease_expires_at = now() - interval '1 second' where id = ${runId}`;
  await sql`select public.requeue_expired_leases()`;
  const [r] = await sql`select status, device_id from public.task_runs where id = ${runId}`;
  expect(r).toMatchObject({ status: "queued", device_id: null });
});

test("F07-N1 rantai tugas melingkar ditolak", async () => {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId);
  await expect(sql`update public.tasks set trigger = 'after_task', after_task_id = ${s.scriptTaskId} where id = ${s.researchTaskId}`).rejects.toThrow(/melingkar/);
});

test("SEC-7 RLS: user lain dan anon tidak melihat apa pun", async () => {
  const a = await createOffice();
  await addContentSetup(a.officeId);
  const b = await createOffice();
  const asUser = async (userId: string | null, q: (tx: typeof sql) => Promise<unknown>) =>
    sql.begin(async (tx) => {
      if (userId) {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
        await tx.unsafe("set local role authenticated");
      } else {
        await tx.unsafe("set local role anon");
      }
      return q(tx);
    });
  const counts = (await asUser(b.userId, (tx) => tx`
    select (select count(*)::int from public.agents where office_id = ${a.officeId}) as agents,
           (select count(*)::int from public.channels where office_id = ${a.officeId}) as channels,
           (select count(*)::int from public.tasks where office_id = ${a.officeId}) as tasks,
           (select count(*)::int from public.offices where id = ${a.officeId}) as offices`)) as { agents: number }[];
  expect(counts[0]).toEqual({ agents: 0, channels: 0, tasks: 0, offices: 0 });
  const own = (await asUser(a.userId, (tx) => tx`select count(*)::int as n from public.agents where office_id = ${a.officeId}`)) as { n: number }[];
  expect(own[0].n).toBeGreaterThan(0);
  const anon = (await asUser(null, (tx) => tx`select count(*)::int as n from public.orders`)) as { n: number }[];
  expect(anon[0].n).toBe(0);
  await expect(asUser(b.userId, (tx) => tx`insert into public.agents (office_id, name, title) values (${a.officeId}, 'Penyusup', 'x')`)).rejects.toThrow(/row-level security/);
});
