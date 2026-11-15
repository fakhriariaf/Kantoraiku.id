import "server-only";
import { z } from "zod";
import { db, many, one, type Sql } from "./db";
import { addActivity } from "./office";
import { humanCode, sha256 } from "./crypto";

// ---------------------------------------------------------------------------
// Anggaran AI dan mode hemat
// ---------------------------------------------------------------------------

export type BudgetState = {
  saver_mode: "off" | "auto" | "on";
  saver_threshold_pct: number;
  ai_budget_cents: number | null;
  spend_micros: number; // bulan ini, zona waktu kantor
  saver_active: boolean;
  skipped_month: number; // run yang dilewati mode hemat bulan ini
  max_revisions: number;
  video_only_charging: boolean;
};

export async function officeSettings(officeId: string) {
  return one<BudgetState>(
    await db(),
    `select o.saver_mode, o.saver_threshold_pct, o.ai_budget_cents::int as ai_budget_cents, o.max_revisions, o.video_only_charging,
            coalesce((select sum(r.cost_usd_micros) from public.task_runs r where r.office_id = o.id
                       and r.finished_at >= (date_trunc('month', now() at time zone o.timezone) at time zone o.timezone)), 0)::float8 as spend_micros,
            (select count(*)::int from public.task_runs r where r.office_id = o.id and r.status = 'skipped'
                       and r.skipped_reason like 'Mode hemat%'
                       and r.finished_at >= (date_trunc('month', now() at time zone o.timezone) at time zone o.timezone)) as skipped_month,
            public.office_saver_active(o.id) as saver_active
       from public.offices o where o.id = $1`,
    [officeId],
  );
}

export const BudgetInput = z.object({
  saver_mode: z.enum(["off", "auto", "on"]),
  /** Dolar per bulan; kosong = tanpa anggaran (mode otomatis tidak pernah menyala). */
  budget_usd: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || (/^\d{1,6}(\.\d{1,2})?$/.test(v) && Number(v) <= 100000), "Isi angka dolar, mis. 20 atau 12.50.")
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100))),
  saver_threshold_pct: z.coerce.number().int().min(10, "Ambang 10 sampai 100 persen.").max(100, "Ambang 10 sampai 100 persen."),
});

export async function saveBudget(officeId: string, b: z.infer<typeof BudgetInput>) {
  await (await db()).query(
    `update public.offices set saver_mode = $2, ai_budget_cents = $3, saver_threshold_pct = $4 where id = $1`,
    [officeId, b.saver_mode, b.budget_usd, b.saver_threshold_pct],
  );
}

export async function saveMaxRevisions(officeId: string, n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 10) return { error: "Batas revisi 1 sampai 10 kali." };
  await (await db()).query(`update public.offices set max_revisions = $2 where id = $1`, [officeId, n]);
  return { ok: true as const };
}

export async function saveVideoOnlyCharging(officeId: string, on: boolean) {
  await (await db()).query(`update public.offices set video_only_charging = $2 where id = $1`, [officeId, on]);
}

// ---------------------------------------------------------------------------
// PC: dipakai untuk video, ganti PC
// ---------------------------------------------------------------------------

/** PC yang dipakai untuk video mengambil tugas video; yang tidak, hanya tugas agent biasa. */
export async function setDeviceVideo(officeId: string, deviceId: string, on: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return { error: "Perangkat tidak ditemukan." };
  const r = await one<{ id: string }>(
    await db(),
    `update public.devices
        set capabilities = case when $3 then array['agents','video'] else array['agents'] end
      where office_id = $1 and id = $2 and status <> 'revoked' and kind like 'pc_%' returning id`,
    [officeId, deviceId, on],
  );
  return r ? { ok: true as const } : { error: "Perangkat tidak ditemukan." };
}

/**
 * Kode setup untuk mengganti PC saat slot penuh. PC lama tetap jalan sampai PC baru tersambung
 * dengan kode ini; saat itu PC lama dicabut otomatis (lihat pair() di device.ts).
 */
export async function createReplaceCode(officeId: string, userId: string, deviceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return { error: "Perangkat tidak ditemukan." };
  const d = await db();
  const dev = await one<{ name: string }>(
    d,
    `select name from public.devices where office_id = $1 and id = $2 and status <> 'revoked' and kind like 'pc_%'`,
    [officeId, deviceId],
  );
  if (!dev) return { error: "Perangkat tidak ditemukan." };
  const code = humanCode(8);
  const r = await one<{ expires_at: string }>(
    d,
    `insert into public.setup_codes (office_id, code_hash, expires_at, created_by, replaces_device_id)
     values ($1, $2, now() + interval '1 hour', $3, $4) returning expires_at`,
    [officeId, sha256(code), userId, deviceId],
  );
  return { ok: true as const, code, expiresAt: new Date(r!.expires_at).toISOString(), replaces: dev.name };
}

// ---------------------------------------------------------------------------
// CS WhatsApp: cara CS membalas
// ---------------------------------------------------------------------------

export type CsSettings = { enabled: boolean; greeting: "kamu" | "kak"; offline_reply: string; quiet_minutes: number; stale_hours: number };

export const CS_DEFAULTS: CsSettings = {
  enabled: true,
  greeting: "kamu",
  offline_reply: "",
  quiet_minutes: 240,
  stale_hours: 12,
};

export async function csSettings(officeId: string, sql?: Sql): Promise<CsSettings> {
  const r = await one<CsSettings>(
    sql ?? (await db()),
    `select enabled, greeting, offline_reply, quiet_minutes, stale_hours from public.cs_settings where office_id = $1`,
    [officeId],
  );
  return r ?? CS_DEFAULTS;
}

export const CsSettingsInput = z.object({
  enabled: z.boolean(),
  greeting: z.enum(["kamu", "kak"]),
  offline_reply: z.string().trim().max(500, "Balasan singkat maksimal 500 karakter."),
  quiet_hours: z.coerce.number().min(0.5, "Isi 0,5 sampai 168 jam.").max(168, "Isi 0,5 sampai 168 jam."),
  stale_hours: z.coerce.number().int("Isi angka jam bulat.").min(1, "Isi 1 sampai 168 jam.").max(168, "Isi 1 sampai 168 jam."),
});

export async function saveCsSettings(officeId: string, s: z.infer<typeof CsSettingsInput>) {
  await (await db()).query(
    `insert into public.cs_settings (office_id, enabled, greeting, offline_reply, quiet_minutes, stale_hours)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (office_id) do update set enabled = excluded.enabled, greeting = excluded.greeting, offline_reply = excluded.offline_reply,
       quiet_minutes = excluded.quiet_minutes, stale_hours = excluded.stale_hours`,
    [officeId, s.enabled, s.greeting, s.offline_reply, Math.round(s.quiet_hours * 60), s.stale_hours],
  );
}

// ---------------------------------------------------------------------------
// Beranda: hari ini, sedang bekerja, anggaran
// ---------------------------------------------------------------------------

export type TodayChannel = { id: string; name: string; published: number; ready: number; slots_left: number };

/** Per channel, hari ini menurut zona waktu kantor. */
export async function todayByChannel(officeId: string) {
  return many<TodayChannel>(
    await db(),
    `select c.id, c.name,
            (select count(*)::int from public.contents x where x.channel_id = c.id and x.stage = 'published'
              and (x.published_at at time zone o.timezone)::date = (now() at time zone o.timezone)::date) as published,
            (select count(*)::int from public.contents x where x.channel_id = c.id
              and (x.stage = 'video_approved' or (x.stage = 'scheduled' and x.scheduled_at <= now()))) as ready,
            (select count(*)::int from unnest(c.post_times) t
              where ((now() at time zone o.timezone)::date + t) > (now() at time zone o.timezone)) as slots_left
       from public.channels c join public.offices o on o.id = c.office_id
      where c.office_id = $1 and c.archived_at is null order by c.created_at`,
    [officeId],
  );
}

/** Catat aktivitas pengaturan penting (ganti PC) supaya muncul di feed kantor. */
export async function noteActivity(officeId: string, kind: string, text: string) {
  await addActivity(await db(), officeId, kind, text);
}
