import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { Feed, type FeedEvent } from "@/components/kantor/feed";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { requestNow } from "@/server/time";
import { officeOverview } from "@/server/office";
import { relativeTime } from "@/lib/format";

type P = { params: Promise<{ slug: string }> };

export default function OfficeHome({ params }: P) {
  return (
    <>
      <PageHeader title="Kantor" description="Siapa sedang mengerjakan apa, dan apa yang menunggu kamu." />
      <Suspense fallback={<HomeSkeleton />}>
        <Home params={params} />
      </Suspense>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

const tone = { idle: "ready", working: "working", waiting_user: "waiting", error: "error" } as const;

async function Home({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const { counts, feed, agents } = await officeOverview(office.id);
  const now = await requestNow();
  const base = `/o/${slug}`;
  const events: FeedEvent[] = feed.map((e) => ({
    id: e.id,
    agentId: e.agent_id ?? "kantor",
    agentName: e.agent_name,
    text: e.text,
    role: e.agent_title ?? "Kantor",
    at: new Date(e.created_at).toISOString(),
    timeLabel: relativeTime(e.created_at, now),
  }));
  const workers = agents.filter((a) => a.kind === "custom");

  return (
    <>
      <AutoRefresh everyMs={10_000} />

      <div className="flex flex-col gap-3">
        {counts.devices === 0 && (
          <Banner
            tone="warning"
            title="Sambungkan PC dulu"
            action={<Button asChild size="sm" variant="secondary"><Link href={`${base}/perangkat`}>Buka Perangkat</Link></Button>}
          >
            Agent bekerja di PC kamu. Tanpa PC tersambung, tugas hanya mengantre.
          </Banner>
        )}
        {counts.devices > 0 && counts.online === 0 && (
          <Banner tone="warning" title="PC kamu offline">
            {counts.queued > 0 ? `${counts.queued} tugas menunggu dan jalan begitu PC menyala lagi.` : "Nyalakan PC dan konektor supaya agent bisa bekerja."}
          </Banner>
        )}
        {counts.waiting > 0 && (
          <Banner
            tone="info"
            title={`${counts.waiting} naskah menunggu persetujuanmu`}
            action={<Button asChild size="sm"><Link href={`${base}/persetujuan`}>Periksa</Link></Button>}
          />
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="meja" className="flex flex-col gap-3">
          <SectionTitle><span id="meja">Meja kerja</span></SectionTitle>
          {workers.length === 0 ? (
            <Card variant="flat">
              <EmptyState
                icon={<Sparkles aria-hidden />}
                title="Kantor masih kosong"
                description="Mulai dengan satu periset dan satu penulis naskah."
                action={<Button asChild><Link href={`${base}/agent/baru`}>Buat agent</Link></Button>}
              />
            </Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {workers.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`${base}/agent/${a.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <Avatar name={a.name} seed={a.id} size="lg" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-base font-semibold text-text">{a.name}</span>
                      <span className="truncate text-sm text-text-muted">{a.title}</span>
                      <StatusPill tone={tone[a.status]} className="self-start" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="aktivitas" className="flex flex-col gap-3">
          <SectionTitle><span id="aktivitas">Aktivitas</span></SectionTitle>
          <Card>
            {events.length ? <Feed events={events} /> : <p className="text-sm text-text-muted">Belum ada aktivitas.</p>}
          </Card>
        </section>
      </div>
    </>
  );
}
