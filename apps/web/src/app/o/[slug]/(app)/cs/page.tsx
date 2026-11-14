import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, ChevronRight, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listBusinessInfo, listConnections, listConversations } from "@/server/cs";
import { listAgents } from "@/server/office";
import { requestNow } from "@/server/time";
import { relativeTime } from "@/lib/format";
import { AgentPicker, SimulatorForm } from "./cs-ui";

type P = { params: Promise<{ slug: string }> };

export default function CsPage({ params }: P) {
  return (
    <>
      <PageHeader
        title="CS WhatsApp"
        description="Agent CS menjawab pelanggan dari info bisnis kamu. Pertanyaan di luar itu diserahkan ke kamu."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Cs params={params} />
      </Suspense>
    </>
  );
}

async function Cs({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const [connections, conversations, agents, info, now] = await Promise.all([
    listConnections(office.id),
    listConversations(office.id),
    listAgents(office.id),
    listBusinessInfo(office.id),
    requestNow(),
  ]);
  const base = `/o/${slug}/cs`;
  const sim = connections.find((c) => c.mode === "simulation");
  const cloud = connections.filter((c) => c.mode === "cloud");
  const workers = agents.filter((a) => a.kind === "custom").map((a) => ({ id: a.id, name: a.name }));

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg">Nomor WhatsApp</h2>
              <p className="text-sm text-text-2">Lewat WhatsApp Cloud API resmi dari Meta, bukan WhatsApp Web.</p>
            </div>
            {cloud.length === 0 && <StatusPill tone="soon">Segera</StatusPill>}
          </div>
          {cloud.length === 0 ? (
            <p className="text-sm text-text-muted">
              Menghubungkan nomor WhatsApp Business sendiri sedang disiapkan. Sementara itu, coba agent CS lewat simulasi di sebelah.
            </p>
          ) : (
            cloud.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-text">{c.display_phone}</span>
                  <StatusPill tone={c.status === "active" ? "online" : "offline"}>{c.status === "active" ? "Aktif" : "Tidak aktif"}</StatusPill>
                </div>
                <AgentPicker slug={slug} connectionId={c.id} label="Agent CS untuk nomor ini" agents={workers} current={c.agent_id} />
              </div>
            ))
          )}
          <Button asChild variant="secondary" className="self-start">
            <Link href={`${base}/info`}>
              <BookOpen aria-hidden />
              Info bisnis ({info.length} bagian)
            </Link>
          </Button>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Coba agent CS (simulasi)</h2>
            <p className="text-sm text-text-2">Ketik sebagai pelanggan dan lihat jawaban agent. Tidak ada pesan yang dikirim ke WhatsApp.</p>
          </div>
          {workers.length === 0 ? (
            <p className="text-sm text-text-muted">
              Buat agent dulu di{" "}
              <Link href={`/o/${slug}/agent/baru`} className="font-semibold text-accent underline underline-offset-2">
                halaman Agent
              </Link>
              , mis. &ldquo;Agent CS&rdquo;.
            </p>
          ) : (
            <>
              <AgentPicker slug={slug} connectionId={sim?.id ?? "simulasi"} label="Agent CS simulasi" agents={workers} current={sim?.agent_id ?? null} />
              <SimulatorForm slug={slug} />
            </>
          )}
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle>Percakapan</SectionTitle>
        {conversations.length === 0 ? (
          <Card variant="flat">
            <EmptyState icon={<MessageCircle aria-hidden />} title="Belum ada percakapan" description="Chat pelanggan dan jawaban agent muncul di sini." />
          </Card>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {conversations.map((c) => {
              const name = c.customer_name ?? c.customer_wa_id;
              return (
                <li key={c.id}>
                  <Link href={`${base}/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                    <Avatar name={name} seed={c.id} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text">{name}</span>
                        {c.mode === "simulation" && <Chip variant="outline">Simulasi</Chip>}
                      </span>
                      <span className="truncate text-sm text-text-2">
                        {c.last_sender === "customer" ? "" : c.last_sender === "human" ? "Kamu: " : "Agent: "}
                        {c.last_body ?? "[lampiran]"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs font-normal text-text-muted">{relativeTime(c.last_message_at, now)}</span>
                      <span className="flex items-center gap-1.5">
                        {c.handled_by === "human" && <StatusPill tone="waiting">Kamu</StatusPill>}
                        {c.unread_count > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-xs font-semibold text-on-accent">
                            <span className="sr-only">Belum dibaca: </span>
                            {c.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
