import "server-only";
import { db, many, one } from "./db";

/**
 * Grid Jadwal: 7 hari × channel. Tiap sel berisi video terjadwal/terbit hari itu dan slot jam posting
 * yang masih kosong. Semua hitungan hari dan jam memakai zona waktu kantor (di SQL), bukan zona server.
 */

export type GridEntry =
  | { kind: "video"; id: string; title: string; time: string; at: string; stage: "scheduled" | "published"; due: boolean; cover_path: string | null }
  | { kind: "slot"; time: string; at: string; past: boolean };

export type GridChannel = {
  id: string;
  name: string;
  group_name: string;
  post_times: string[];
  queue: { id: string; title: string }[];
  cells: Record<string, GridEntry[]>; // kunci: tanggal YYYY-MM-DD
};

export type GridDay = { date: string; weekday: number; today: boolean };

/** start: tanggal pertama (YYYY-MM-DD); null = hari ini menurut zona waktu kantor. */
export async function scheduleGrid(officeId: string, startOrToday: string | null) {
  const d = await db();
  const meta = await one<{ today: string; tz: string }>(
    d,
    `select to_char(now() at time zone o.timezone, 'YYYY-MM-DD') as today, o.timezone as tz from public.offices o where o.id = $1`,
    [officeId],
  );
  const tz = meta?.tz ?? "Asia/Jakarta";
  const today = meta?.today ?? new Date().toISOString().slice(0, 10);
  const start = startOrToday ?? today;

  const [channels, slots, videos, queue] = await Promise.all([
    many<{ id: string; name: string; group_name: string; post_times: string[] }>(
      d,
      `select c.id, c.name, c.group_name, array(select to_char(t, 'HH24:MI') from unnest(c.post_times) t order by t) as post_times
         from public.channels c where c.office_id = $1 and c.archived_at is null
        order by c.group_name = '', lower(c.group_name), c.created_at`,
      [officeId],
    ),
    // Slot jam posting tiap hari di rentang ini, dalam zona waktu kantor.
    many<{ channel_id: string; day: string; time: string; at: string; past: boolean }>(
      d,
      // date + time = timestamp lokal; "at time zone" mengubahnya ke timestamptz menurut zona kantor.
      `select c.id as channel_id, to_char(g.d, 'YYYY-MM-DD') as day, to_char(t, 'HH24:MI') as time,
              ((g.d + t) at time zone o.timezone) as at, ((g.d + t) at time zone o.timezone) <= now() as past
         from public.channels c join public.offices o on o.id = c.office_id
         cross join lateral (select $2::date + i as d from generate_series(0, 6) i) g
         cross join unnest(c.post_times) t
        where c.office_id = $1 and c.archived_at is null`,
      [officeId, start],
    ),
    // Video terjadwal/terbit di rentang ini. Yang terbit tampil di jam slotnya (bila ada), selain itu di jam terbit.
    many<{ id: string; channel_id: string; title: string; stage: "scheduled" | "published"; at: string; day: string; time: string; due: boolean; cover_path: string | null }>(
      d,
      `select c.id, c.channel_id, c.title, c.stage, x.at, to_char(x.at at time zone o.timezone, 'YYYY-MM-DD') as day,
              to_char(x.at at time zone o.timezone, 'HH24:MI') as time, (c.stage = 'scheduled' and x.at <= now()) as due, c.cover_path
         from public.contents c join public.offices o on o.id = c.office_id
         cross join lateral (select coalesce(c.scheduled_at, c.published_at) as at) x
        where c.office_id = $1 and c.stage in ('scheduled', 'published')
          and x.at >= ($2::date::timestamp at time zone o.timezone)
          and x.at < (($2::date + 7)::timestamp at time zone o.timezone)
        order by x.at`,
      [officeId, start],
    ),
    // Antrean: video yang sudah disetujui tapi belum punya slot.
    many<{ id: string; channel_id: string; title: string }>(
      d,
      `select id, channel_id, title from public.contents where office_id = $1 and stage = 'video_approved' order by updated_at`,
      [officeId],
    ),
  ]);

  const days: GridDay[] = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(`${start}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + i);
    const date = dt.toISOString().slice(0, 10);
    return { date, weekday: dt.getUTCDay(), today: date === today };
  });

  const grid: GridChannel[] = channels.map((c) => {
    const cells: Record<string, GridEntry[]> = {};
    for (const day of days) {
      const vids = videos.filter((v) => v.channel_id === c.id && v.day === day.date);
      const taken = new Set(vids.map((v) => new Date(v.at).getTime()));
      const entries: GridEntry[] = [
        ...vids.map((v) => ({
          kind: "video" as const,
          id: v.id,
          title: v.title,
          time: v.time,
          at: new Date(v.at).toISOString(),
          stage: v.stage,
          due: v.due,
          cover_path: v.cover_path,
        })),
        ...slots
          .filter((s) => s.channel_id === c.id && s.day === day.date && !taken.has(new Date(s.at).getTime()))
          .map((s) => ({ kind: "slot" as const, time: s.time, at: new Date(s.at).toISOString(), past: s.past })),
      ];
      cells[day.date] = entries.sort((a, b) => a.time.localeCompare(b.time));
    }
    return {
      ...c,
      queue: queue.filter((q) => q.channel_id === c.id).map(({ id, title }) => ({ id, title })),
      cells,
    };
  });

  return { tz, today, days, channels: grid };
}

/**
 * Isi slot kosong dengan video dari antrean. Slot harus salah satu jam posting channel itu, masih di depan,
 * dan belum dipakai (indeks unik contents_one_per_slot menjaga dua klik bersamaan).
 */
export async function fillSlot(officeId: string, contentId: string, slotAt: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contentId) || Number.isNaN(Date.parse(slotAt))) return { error: "Slot atau video tidak valid." };
  try {
    const r = await one<{ title: string }>(
      await db(),
      `update public.contents c set stage = 'scheduled', scheduled_at = $3::timestamptz
         from public.channels ch join public.offices o on o.id = ch.office_id
        where c.office_id = $1 and c.id = $2 and c.stage = 'video_approved' and ch.id = c.channel_id
          and $3::timestamptz > now()
          and ($3::timestamptz at time zone o.timezone)::time = any (ch.post_times)
          and not exists (select 1 from public.contents x where x.channel_id = c.channel_id and x.scheduled_at = $3::timestamptz
                           and x.stage in ('scheduled', 'published'))
        returning c.title`,
      [officeId, contentId, slotAt],
    );
    if (!r) return { error: "Slot ini sudah terisi, sudah lewat, atau videonya tidak lagi di antrean." };
    return { ok: true as const, title: r.title };
  } catch (e) {
    if (e instanceof Error && /contents_one_per_slot|duplicate key/.test(e.message)) return { error: "Slot ini baru saja diisi video lain." };
    throw e;
  }
}
