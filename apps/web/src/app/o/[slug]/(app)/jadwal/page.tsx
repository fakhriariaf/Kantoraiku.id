import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listSchedule, type ScheduleItem } from "@/server/office";
import { requestNow } from "@/server/time";
import { dateTime, timeOnly } from "@/lib/format";
import { PublishButton } from "./publish-button";

type P = { params: Promise<{ slug: string }> };

export default function SchedulePage({ params }: P) {
  return (
    <>
      <PageHeader title="Jadwal terbit" description="Video yang sudah kamu setujui, dijadwalkan sesuai jam posting tiap channel." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Schedule params={params} />
      </Suspense>
    </>
  );
}

function dayLabel(at: string, tz: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(new Date(at));
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

async function Schedule({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const tz = office.timezone || "Asia/Jakarta";
  const [items, now] = await Promise.all([listSchedule(office.id), requestNow()]);

  const isDue = (i: ScheduleItem) => i.stage === "video_approved" || (i.stage === "scheduled" && !!i.scheduled_at && new Date(i.scheduled_at).getTime() <= now);
  const due = items.filter(isDue);
  const upcoming = items.filter((i) => i.stage === "scheduled" && !isDue(i));
  const published = items.filter((i) => i.stage === "published");
  const days = new Map<string, ScheduleItem[]>();
  for (const i of upcoming) {
    const k = dayLabel(i.scheduled_at!, tz);
    days.set(k, [...(days.get(k) ?? []), i]);
  }
  const publish = (i: ScheduleItem) => <PublishButton slug={slug} contentId={i.id} title={i.title} />;

  if (items.length === 0) {
    return (
      <Card variant="flat">
        <EmptyState
          icon={<CalendarDays aria-hidden />}
          title="Belum ada video yang dijadwalkan"
          description="Setelah kamu menyetujui video, video itu masuk ke jam posting channel. Atur jam posting di menu Channel."
          action={
            <Button asChild variant="secondary">
              <Link href={`/o/${slug}/channel`}>Atur jam posting</Link>
            </Button>
          }
        />
      </Card>
    );
  }

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

      {[...days].map(([day, list]) => (
        <section key={day} className="flex flex-col gap-3">
          <SectionTitle>{day}</SectionTitle>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {list.map((i) => (
              <Row key={i.id} item={i} slug={slug} tz={tz} action={publish(i)} />
            ))}
          </ul>
        </section>
      ))}

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
