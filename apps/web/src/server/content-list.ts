import "server-only";
import { db, many, one } from "./db";

/**
 * Menu Konten: semua hasil kerja agent dalam satu daftar, dikelompokkan per keadaan.
 * Isinya konten (naskah/video) ditambah run yang tidak menghasilkan konten: run gagal dan laporan tugas umum.
 */
export const CONTENT_TABS = ["keputusan", "gagal", "dikerjakan", "siap", "terbit", "laporan", "ditolak"] as const;
export type ContentTab = (typeof CONTENT_TABS)[number];

export type ContentItem = {
  kind: "content" | "run";
  id: string;
  tab: ContentTab;
  title: string;
  channel_id: string | null;
  channel_name: string | null;
  stage: string; // tahap konten, atau status run
  detail: string | null; // alasan gagal, nama agent, dsb.
  revision: number;
  at: string; // waktu terakhir berubah
};

type ContentRow = {
  id: string;
  title: string;
  stage: string;
  channel_id: string;
  channel_name: string;
  revision: number;
  failure_reason: string | null;
  updated_at: string;
};

type RunRow = {
  id: string;
  status: "failed" | "succeeded";
  task_name: string;
  task_kind: string;
  agent_name: string;
  channel_id: string | null;
  channel_name: string | null;
  error: string | null;
  finished_at: string;
};

function tabOf(c: ContentRow): ContentTab {
  switch (c.stage) {
    case "script_review":
    case "video_review":
      return "keputusan";
    case "failed":
      return "gagal";
    case "video_approved":
    case "scheduled":
      return "siap";
    case "published":
      return "terbit";
    case "rejected":
      return "ditolak";
    case "script_approved":
      // Naskah disetujui tapi video gagal dibuat: tampil di Gagal sampai tugas videonya dijalankan lagi.
      return c.failure_reason ? "gagal" : "dikerjakan";
    default:
      return "dikerjakan";
  }
}

/** Run gagal 7 hari terakhir yang tidak terikat konten (yang terikat konten sudah tampil lewat kontennya). */
const FAILED_RUN_DAYS = 7;

export async function listContentItems(officeId: string): Promise<ContentItem[]> {
  const d = await db();
  const [contents, runs] = await Promise.all([
    many<ContentRow>(
      d,
      `select c.id, c.title, c.stage, c.channel_id, ch.name as channel_name, c.revision, c.failure_reason, c.updated_at
         from public.contents c join public.channels ch on ch.id = c.channel_id
        where c.office_id = $1 order by c.updated_at desc limit 500`,
      [officeId],
    ),
    many<RunRow>(
      d,
      `(select r.id, r.status, t.name as task_name, t.kind as task_kind, a.name as agent_name, coalesce(r.channel_id, t.channel_id) as channel_id, ch.name as channel_name,
               r.error, r.finished_at
          from public.task_runs r join public.tasks t on t.id = r.task_id join public.agents a on a.id = r.agent_id
          left join public.channels ch on ch.id = coalesce(r.channel_id, t.channel_id)
         where r.office_id = $1 and r.status = 'failed' and r.content_id is null
           and r.finished_at > now() - make_interval(days => $2)
         order by r.finished_at desc limit 100)
       union all
       (select r.id, r.status, t.name, t.kind, a.name, coalesce(r.channel_id, t.channel_id), ch.name, r.error, r.finished_at
          from public.task_runs r join public.tasks t on t.id = r.task_id join public.agents a on a.id = r.agent_id
          left join public.channels ch on ch.id = coalesce(r.channel_id, t.channel_id)
         where r.office_id = $1 and r.status = 'succeeded' and t.kind = 'general' and r.output ->> 'summary_md' is not null
         order by r.finished_at desc limit 50)`,
      [officeId, FAILED_RUN_DAYS],
    ),
  ]);

  const items: ContentItem[] = [
    ...contents.map((c) => ({
      kind: "content" as const,
      id: c.id,
      tab: tabOf(c),
      title: c.title,
      channel_id: c.channel_id,
      channel_name: c.channel_name,
      stage: c.stage,
      detail: tabOf(c) === "gagal" ? c.failure_reason : null,
      revision: c.revision,
      at: new Date(c.updated_at).toISOString(),
    })),
    ...runs.map((r) => ({
      kind: "run" as const,
      id: r.id,
      tab: (r.status === "failed" ? "gagal" : "laporan") as ContentTab,
      title: r.task_name,
      channel_id: r.channel_id,
      channel_name: r.channel_name,
      stage: r.status,
      detail: r.status === "failed" ? r.error : r.agent_name,
      revision: 0,
      at: new Date(r.finished_at).toISOString(),
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export type RunDetail = {
  id: string;
  status: string;
  task_name: string;
  task_kind: string;
  agent_name: string;
  channel_name: string | null;
  error: string | null;
  summary_md: string | null;
  trigger_source: string;
  created_at: string;
  finished_at: string | null;
};

export async function getRunDetail(officeId: string, id: string) {
  return one<RunDetail>(
    await db(),
    `select r.id, r.status, t.name as task_name, t.kind as task_kind, a.name as agent_name, ch.name as channel_name, r.error,
            r.output ->> 'summary_md' as summary_md, r.trigger_source, r.created_at, r.finished_at
       from public.task_runs r join public.tasks t on t.id = r.task_id join public.agents a on a.id = r.agent_id
       left join public.channels ch on ch.id = coalesce(r.channel_id, t.channel_id)
      where r.office_id = $1 and r.id = $2`,
    [officeId, id],
  );
}
