import { Suspense } from "react";
import { Tv } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listChannels } from "@/server/office";
import { ModeSwitch, NewChannelForm } from "./channel-ui";

type P = { params: Promise<{ slug: string }> };

export default function ChannelPage({ params }: P) {
  return (
    <>
      <PageHeader title="Channel" description="Satu channel = satu identitas konten: niche, bahasa, dan cara persetujuan." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Channels params={params} />
      </Suspense>
    </>
  );
}

async function Channels({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const channels = await listChannels(office.id);

  return (
    <>
      {channels.length === 0 ? (
        <Card variant="flat">
          <EmptyState icon={<Tv aria-hidden />} title="Belum ada channel" description="Buat channel pertama di bawah, lalu beri agent tugas riset dan menulis untuknya." />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {channels.map((c) => (
            <li key={c.id}>
              <Card className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="truncate text-lg">{c.name}</h2>
                    <p className="text-xs font-normal text-text-muted">{c.contents} konten</p>
                  </div>
                  <Chip variant="outline">{c.content_language === "en" ? "English" : "Indonesia"}</Chip>
                </div>
                {c.niche && <p className="line-clamp-3 text-sm text-text-2">{c.niche}</p>}
                <ModeSwitch slug={slug} channelId={c.id} mode={c.mode} />
              </Card>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3">
        <SectionTitle>Channel baru</SectionTitle>
        <Card>
          <NewChannelForm slug={slug} />
        </Card>
      </section>
    </>
  );
}
