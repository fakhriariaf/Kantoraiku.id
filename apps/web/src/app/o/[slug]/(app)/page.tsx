import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Feed, type FeedEvent } from "@/components/kantor/feed";
import { OfficeMap, type MapAgent, type MapStatus } from "@/components/kantor/office-map";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { requestNow } from "@/server/time";
import { agentActivity, officeOverview, type AgentActivity, type AgentRow } from "@/server/office";
import { characterFor, placeAgents, ROBOT_SPOT, ROOMS } from "@/lib/office-map";
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
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="aspect-[3/2] w-full rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

const tone: Record<AgentRow["status"], MapStatus> = { idle: "ready", working: "working", waiting_user: "waiting", error: "error" };

function bubble(a: AgentRow, act: AgentActivity | undefined): MapAgent["activity"] {
  if (act?.kind === "approval") return { lead: "Menunggu kamu:", text: `“${act.label}”` };
  if (a.status === "waiting_user") return { lead: "Menunggu kamu:", text: "ada hasil untuk diperiksa" };
  if (a.status === "error") return { lead: "Bermasalah:", text: "cek riwayat di halaman Tugas" };
  if (act?.kind === "run") return { lead: act.progress_pct == null ? "Sedang mengerjakan:" : `Mengerjakan ${act.progress_pct}%:`, text: act.label };
  return null;
}

async function Home({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const [{ counts, feed, agents }, activity] = await Promise.all([officeOverview(office.id), agentActivity(office.id)]);
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
  const { placed, hidden } = placeAgents(workers);
  const mapAgents: MapAgent[] = placed.map(({ agent: a, room, spot }) => ({
    id: a.id,
    name: a.name,
    title: a.title,
    room: ROOMS[room].label,
    x: spot.x,
    y: spot.y,
    lift: spot.lift ?? 0,
    character: characterFor(a.id, a.appearance),
    pose: spot.pose,
    status: tone[a.status],
    activity: bubble(a, activity.get(a.id)),
    href: `${base}/agent/${a.id}`,
  }));
  const assistant = agents.find((a) => a.kind === "assistant");
  if (assistant) {
    mapAgents.push({
      id: assistant.id,
      name: assistant.name,
      title: assistant.title,
      room: "Lounge",
      ...ROBOT_SPOT,
      lift: 0,
      character: null,
      pose: "berdiri",
      status: "ready",
      activity: null,
      href: `${base}/asisten`,
    });
  }
  const firstWaiting = mapAgents.find((a) => a.status === "waiting")?.id ?? null;

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
            action={<Button asChild size="sm"><Link href={`${base}/konten`}>Periksa</Link></Button>}
          />
        )}
      </div>

      <div className="flex flex-col gap-8">
        <section aria-labelledby="denah" className="flex min-w-0 flex-col gap-3">
          <SectionTitle><span id="denah">Denah kantor</span></SectionTitle>
          <OfficeMap agents={mapAgents} offline={counts.online === 0} approvalsHref={`${base}/konten`} initialId={firstWaiting} />
          {hidden.length > 0 && (
            <p className="text-sm text-text-muted">
              {hidden.length} agent lain belum kebagian tempat di denah.{" "}
              <Link href={`${base}/agent`} className="font-semibold text-accent underline underline-offset-2">Lihat semua agent</Link>
            </p>
          )}
          {workers.length === 0 && (
            <Card variant="flat">
              <EmptyState
                icon={<Sparkles aria-hidden />}
                title="Kantor masih kosong"
                description="Mulai dengan satu periset dan satu penulis naskah."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild><Link href={`${base}/asisten`}>Setup dengan Asisten</Link></Button>
                    <Button asChild variant="secondary"><Link href={`${base}/agent/baru`}>Buat agent sendiri</Link></Button>
                  </div>
                }
              />
            </Card>
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
