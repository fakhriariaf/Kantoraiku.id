import { Suspense } from "react";
import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { requestNow } from "@/server/time";
import { listAgents, listChannels, listRuns, listTasks } from "@/server/office";
import { relativeTime, scheduleLabel } from "@/lib/format";
import { NewTaskForm, TaskRowActions } from "./task-ui";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ agent?: string }> };

const KIND = { research: "Riset", script: "Naskah", video: "Video", general: "Umum" } as const;

const RUN: Record<string, { tone: StatusTone; label: string }> = {
  queued: { tone: "ready", label: "Mengantre" },
  claimed: { tone: "working", label: "Diambil PC" },
  running: { tone: "working", label: "Berjalan" },
  succeeded: { tone: "online", label: "Selesai" },
  failed: { tone: "error", label: "Gagal" },
  skipped: { tone: "soon", label: "Dilewati" },
  cancelled: { tone: "offline", label: "Dibatalkan" },
};

export default function TasksPage(props: P) {
  return (
    <>
      <PageHeader title="Tugas" description="Apa yang dikerjakan agent, dan kapan." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Tasks {...props} />
      </Suspense>
    </>
  );
}

async function Tasks({ params, searchParams }: P) {
  const [{ slug }, { agent }] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const [tasks, agents, channels, runs] = await Promise.all([
    listTasks(office.id),
    listAgents(office.id),
    listChannels(office.id),
    listRuns(office.id, 15),
  ]);
  const workers = agents.filter((a) => a.kind === "custom");
  const now = await requestNow();

  return (
    <>
      <AutoRefresh everyMs={8_000} />
      {tasks.length === 0 ? (
        <Card variant="flat">
          <EmptyState icon={<ListChecks aria-hidden />} title="Belum ada tugas" description="Contoh alur: Riset harian (terjadwal 06.00), lalu Tulis naskah (setelah riset)." />
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {tasks.map((t) => {
            const last = t.last_status ? RUN[t.last_status] : null;
            return (
              <li key={t.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-text">{t.name}</span>
                    <Chip>{KIND[t.kind]}</Chip>
                    {!t.enabled && <StatusPill tone="offline">Nonaktif</StatusPill>}
                  </div>
                  <p className="text-sm text-text-2">
                    {t.agent_name}
                    {t.channel_name && ` · ${t.channel_name}`} · {scheduleLabel(t)}
                  </p>
                  {last && (
                    <p className="flex items-center gap-2 text-xs font-normal text-text-muted">
                      Terakhir: <StatusPill tone={last.tone}>{last.label}</StatusPill>
                      {t.last_finished_at && relativeTime(t.last_finished_at, now)}
                    </p>
                  )}
                </div>
                <TaskRowActions slug={slug} taskId={t.id} taskName={t.name} enabled={t.enabled} />
              </li>
            );
          })}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>Tugas baru</SectionTitle>
        <Card>
          <NewTaskForm
            slug={slug}
            agents={workers.map((a) => ({ id: a.id, name: a.name }))}
            channels={channels.map((c) => ({ id: c.id, name: c.name }))}
            tasks={tasks.map((t) => ({ id: t.id, name: t.name }))}
            defaultAgent={workers.some((a) => a.id === agent) ? agent : undefined}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle>Riwayat run</SectionTitle>
        {runs.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada run.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-text">
                    {r.task_name} <span className="font-normal text-text-muted">· {r.agent_name}</span>
                  </span>
                  {(r.error || r.skipped_reason || r.progress_message) && (
                    <span className={`text-xs font-normal ${r.error ? "text-danger" : "text-text-muted"}`}>
                      {r.error ?? r.skipped_reason ?? r.progress_message}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-normal text-text-muted">
                  {(r.input_tokens > 0 || r.output_tokens > 0) && <span>{Number(r.input_tokens) + Number(r.output_tokens)} token</span>}
                  <span>{relativeTime(r.created_at, now)}</span>
                  <StatusPill tone={RUN[r.status].tone}>{RUN[r.status].label}</StatusPill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
