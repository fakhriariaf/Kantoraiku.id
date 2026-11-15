import Link from "next/link";
import { Suspense } from "react";
import { Plus, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listChannels, type ChannelSummary } from "@/server/office";
import { dateTime } from "@/lib/format";
import { ModeSwitch, NewChannelForm } from "./channel-ui";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ disimpan?: string }> };

export default function ChannelPage({ params, searchParams }: P) {
  return (
    <>
      <PageHeader
        title="Channel"
        description="Satu channel = satu identitas konten. Atur jam posting, mode, dan grupnya di sini."
        actions={
          <Button asChild>
            <a href="#channel-baru">
              <Plus aria-hidden />
              Channel baru
            </a>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Channels params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const hhmm = (t: string) => t.replace(":", ".");

function Times({ times, empty }: { times: string[]; empty: string }) {
  if (!times.length) return <span className="text-text-muted">{empty}</span>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-1 md:justify-start">
      {times.map((t) => (
        <Chip key={t} className="font-mono">
          {hhmm(t)}
        </Chip>
      ))}
    </span>
  );
}

function sameDay(a: Date, b: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, dateStyle: "short" });
  return f.format(a) === f.format(b);
}

async function Channels({ params, searchParams }: P) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const tz = office.timezone || "Asia/Jakarta";
  const channels = await listChannels(office.id);
  const saved = channels.find((c) => c.id === q.disimpan);
  const groups = [...new Set(channels.map((c) => c.group_name))];
  const now = new Date();

  const columns: Column<ChannelSummary>[] = [
    {
      key: "name",
      header: "Channel",
      cell: (c) => (
        <span className="flex min-w-0 flex-col items-end gap-0.5 md:items-start">
          <span className="flex items-center gap-2">
            <Link href={`/o/${slug}/channel/${c.id}`} aria-label={`Atur channel ${c.name}`} className="font-semibold text-text hover:underline">
              {c.name}
            </Link>
            <Chip variant="tag">{c.content_language}</Chip>
          </span>
          <span className="text-xs text-text-muted">
            {c.contents} konten{c.queue > 0 && ` · antrean ${c.queue}`}
          </span>
        </span>
      ),
    },
    {
      key: "next",
      header: "Posting berikutnya",
      cell: (c) =>
        c.next_post_at ? (
          <span className="font-semibold">
            {sameDay(new Date(c.next_post_at), now, tz)
              ? `Hari ini ${new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: tz }).format(new Date(c.next_post_at))}`
              : dateTime(c.next_post_at, tz)}
          </span>
        ) : (
          <span className="text-text-muted">Belum ada</span>
        ),
    },
    { key: "post", header: "Jam posting", cell: (c) => <Times times={c.post_times} empty="Belum ada jam posting" /> },
    {
      key: "research",
      header: "Riset",
      cell: (c) =>
        c.research_times.length ? (
          <Times times={c.research_times} empty="" />
        ) : (
          <span className="text-text-muted">{c.research_manual ? "Manual" : "Belum ada tugas riset"}</span>
        ),
    },
    {
      key: "mode",
      header: "Mode",
      cell: (c) => <ModeSwitch slug={slug} channelId={c.id} mode={c.mode} compact label={`Mode channel ${c.name}`} />,
    },
    { key: "perday", header: "Per hari", className: "md:text-right", cell: (c) => <span className="tabular-nums">{c.post_times.length || "–"}</span> },
  ];

  return (
    <>
      {saved && <Banner tone="success" title={`Channel "${saved.name}" tersimpan`}>Jam posting baru dipakai untuk video berikutnya yang kamu setujui.</Banner>}
      {channels.length === 0 ? (
        <Card variant="flat">
          <EmptyState icon={<Tv aria-hidden />} title="Belum ada channel" description="Buat channel pertama di bawah, lalu beri agent tugas riset dan menulis untuknya." />
        </Card>
      ) : (
        <>
          <p className="text-sm text-text-2">
            Klik nama channel untuk mengubah jam posting, grup, dan visual video. Jam riset mengikuti tugas riset channel itu (menu Agent › Tugas).
            Per hari = jumlah jam posting.
          </p>
          {groups.map((g) => (
            <section key={g || "tanpa-grup"} className="flex flex-col gap-2" aria-label={g || "Tanpa grup"}>
              {(groups.length > 1 || g) && <h2 className="text-sm font-semibold text-text-2">{g || "Tanpa grup"}</h2>}
              <DataTable
                caption={g ? `Channel di grup ${g}` : "Daftar channel"}
                columns={columns}
                rows={channels.filter((c) => c.group_name === g)}
                rowKey={(c) => c.id}
              />
            </section>
          ))}
        </>
      )}
      <section id="channel-baru" className="flex scroll-mt-24 flex-col gap-3">
        <SectionTitle>Channel baru</SectionTitle>
        <Card>
          <NewChannelForm slug={slug} groups={groups.filter(Boolean)} />
        </Card>
      </section>
    </>
  );
}
