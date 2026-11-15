import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listSchedule, type ScheduleItem } from "@/server/office";
import { scheduleGrid, type GridChannel, type GridDay, type GridEntry } from "@/server/schedule-grid";
import { requestNow } from "@/server/time";
import { dateTime, timeOnly } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PublishButton } from "./publish-button";
import { SlotFill } from "./slot-fill";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ mulai?: string }> };

export default function SchedulePage(props: P) {
  return (
    <>
      <PageHeader title="Jadwal" description="Video terjadwal per channel selama 7 hari. Video yang kamu setujui otomatis masuk ke jam posting kosong berikutnya." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Schedule {...props} />
      </Suspense>
    </>
  );
}

function Row({ item, slug, tz, action }: { item: ScheduleItem; slug: string; tz: string; action?: React.ReactNode }) {
  const link = item.publish_results.find((r) => r.url)?.url;
  const at = item.stage === "published" ? item.published_at : item.scheduled_at;
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
      <span className="w-16 shrink-0 font-mono text-sm text-text-2">{at ? timeOnly(at, tz) : "—"}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Link href={`/o/${slug}/konten/${item.id}`} className="truncate text-sm font-semibold text-text hover:underline">
          {item.title}
        </Link>
        <span className="text-xs font-normal text-text-muted">
          {item.channel_name}
          {item.duration_s ? ` · ${item.duration_s} detik` : ""}
        </span>
      </span>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          Lihat postingan
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      )}
      {action}
    </li>
  );
}

const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmt = (date: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { ...o, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const hhmm = (t: string) => t.replace(":", ".");

const STATUS = {
  due: { dot: "bg-warning-dot", label: "Waktunya posting" },
  scheduled: { dot: "bg-text-muted", label: "Terjadwal" },
  published: { dot: "bg-success", label: "Terbit" },
} as const;

function Entry({ e, c, day, slug }: { e: GridEntry; c: GridChannel; day: GridDay; slug: string }) {
  const dayLabel = fmt(day.date, { weekday: "long", day: "numeric", month: "long" });
  if (e.kind === "slot") {
    if (!e.past && c.queue.length > 0) {
      return <SlotFill slug={slug} channel={c.name} dayLabel={dayLabel} time={e.time} at={e.at} queue={c.queue} />;
    }
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border-strong px-2.5 py-2 text-xs text-text-muted">
        <span className="font-mono">{hhmm(e.time)}</span>
        <span>{e.past ? "terlewat" : "kosong"}</span>
      </div>
    );
  }
  const st = e.stage === "published" ? STATUS.published : e.due ? STATUS.due : STATUS.scheduled;
  return (
    <Link
      href={`/o/${slug}/konten/${e.id}`}
      className="flex flex-col gap-1 rounded-md border border-border bg-surface px-2.5 py-2 text-xs shadow-card transition-colors hover:border-border-strong"
    >
      <span className="flex items-center gap-1.5 font-mono font-semibold text-text">
        {hhmm(e.time)}
        <span aria-hidden className={cn("size-1.5 rounded-pill", st.dot)} />
        <span className="sr-only">{st.label}</span>
      </span>
      <span className="line-clamp-3 font-sans text-text">{e.title}</span>
    </Link>
  );
}

async function Schedule({ params, searchParams }: P) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const tz = office.timezone || "Asia/Jakarta";
  const now = await requestNow();
  const wanted = q.mulai && /^\d{4}-\d{2}-\d{2}$/.test(q.mulai) && !Number.isNaN(Date.parse(q.mulai)) ? q.mulai : null;
  const [grid, items] = await Promise.all([scheduleGrid(office.id, wanted), listSchedule(office.id)]);
  const start = grid.days[0].date;

  const isDue = (i: ScheduleItem) => i.stage === "video_approved" || (i.stage === "scheduled" && !!i.scheduled_at && new Date(i.scheduled_at).getTime() <= now);
  const due = items.filter(isDue);
  const published = items.filter((i) => i.stage === "published");
  const publish = (i: ScheduleItem) => <PublishButton slug={slug} contentId={i.id} title={i.title} />;
  const hasSlots = grid.channels.some((c) => c.post_times.length > 0);
  const base = `/o/${slug}/jadwal`;
  const range = `${fmt(start, { day: "numeric" })} sampai ${fmt(grid.days[6].date, { day: "numeric", month: "long", year: "numeric" })}`;

  return (
    <>
      <AutoRefresh everyMs={30_000} />

      {due.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <SectionTitle>Waktunya posting</SectionTitle>
            <StatusPill tone="waiting">{due.length}</StatusPill>
          </div>
          <p className="text-sm text-text-2">Unggah video dari PC kamu ke platform, lalu tandai di sini.</p>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {due.map((i) => (
              <Row key={i.id} item={i} slug={slug} tz={tz} action={publish(i)} />
            ))}
          </ul>
        </section>
      )}

      {items.length === 0 && (
        <Card variant="flat">
          <EmptyState
            icon={<CalendarDays aria-hidden />}
            title="Belum ada video yang dijadwalkan"
            description={
              hasSlots
                ? "Setelah kamu menyetujui video, video itu masuk ke jam posting kosong berikutnya di grid ini."
                : "Setelah kamu menyetujui video, video itu masuk ke jam posting channel. Atur jam posting di menu Channel."
            }
            action={
              hasSlots ? undefined : (
                <Button asChild variant="secondary">
                  <Link href={`/o/${slug}/channel`}>Atur jam posting</Link>
                </Button>
              )
            }
          />
        </Card>
      )}

      {grid.channels.length > 0 && (hasSlots || items.length > 0) && (
        <section className="flex flex-col gap-3" aria-labelledby="minggu-ini">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`${base}?mulai=${shiftDate(start, -7)}`} aria-label="7 hari sebelumnya">
                <ChevronLeft aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`${base}?mulai=${shiftDate(start, 7)}`} aria-label="7 hari berikutnya">
                <ChevronRight aria-hidden />
              </Link>
            </Button>
            <h2 id="minggu-ini" className="text-base">
              {start === grid.today ? "7 hari ke depan" : "7 hari"} <span className="font-normal text-text-2">{range}</span>
            </h2>
            {start !== grid.today && (
              <Button asChild variant="ghost" size="sm">
                <Link href={base}>Hari ini</Link>
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[60rem] table-fixed border-collapse text-sm">
              <caption className="sr-only">Jadwal posting per channel, {range}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 z-10 w-32 bg-surface md:w-44 px-3 py-2.5 text-left text-xs font-semibold text-text-muted">
                    Channel
                  </th>
                  {grid.days.map((d) => {
                    const entries = grid.channels.flatMap((c) => c.cells[d.date] ?? []);
                    const posts = entries.filter((e) => e.kind === "video").length;
                    const empty = entries.filter((e) => e.kind === "slot" && !e.past).length;
                    return (
                      <th key={d.date} scope="col" className={cn("px-2 py-2.5 text-left align-top", d.today && "bg-accent-soft/50")}>
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                          {fmt(d.date, { weekday: "short", day: "numeric" })}
                          {d.today && <span className="text-xs font-semibold text-accent">Hari ini</span>}
                        </span>
                        <span className="block text-xs font-normal text-text-muted">
                          {posts || empty ? [posts && `${posts} posting`, empty && `${empty} kosong`].filter(Boolean).join(" · ") : "Tidak ada"}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grid.channels.map((c) => (
                  <tr key={c.id}>
                    <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-3 text-left align-top font-normal">
                      <Link href={`/o/${slug}/channel/${c.id}`} className="block truncate text-sm font-semibold text-text hover:underline">
                        {c.name}
                      </Link>
                      <span className="block text-xs text-text-muted">
                        {c.post_times.length ? c.post_times.map(hhmm).join(", ") : "Belum ada jam posting"}
                      </span>
                      <span className="block text-xs text-text-muted">Antrean: {c.queue.length || "kosong"}</span>
                    </th>
                    {grid.days.map((d) => (
                      <td key={d.date} className={cn("px-2 py-3 align-top", d.today && "bg-accent-soft/30")}>
                        <div className="flex flex-col gap-1.5">
                          {(c.cells[d.date] ?? []).map((e) => (
                            <Entry key={e.kind === "video" ? e.id : `${e.at}`} e={e} c={c} day={d} slug={slug} />
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul aria-label="Keterangan" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-2">
            {Object.values(STATUS).map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2 rounded-pill", s.dot)} />
                {s.label}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-sm border border-dashed border-border-strong" />
              Slot kosong (bisa diisi dari antrean)
            </li>
          </ul>
        </section>
      )}

      {published.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Sudah terbit</SectionTitle>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {published.map((i) => (
              <Row
                key={i.id}
                item={i}
                slug={slug}
                tz={tz}
                action={<span className="text-xs font-normal text-text-muted">{i.published_at && dateTime(i.published_at, tz)}</span>}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
