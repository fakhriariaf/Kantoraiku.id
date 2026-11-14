import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { getAgent, listTasks } from "@/server/office";
import { scheduleLabel } from "@/lib/format";
import { AgentForm } from "../agent-form";

type P = { params: Promise<{ slug: string; id: string }> };

export default function EditAgentPage({ params }: P) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: P) {
  const { slug, id } = await params;
  const { office } = await requireMember(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const agent = await getAgent(office.id, id);
  if (!agent || agent.archived_at || agent.kind !== "custom") notFound();
  const tasks = (await listTasks(office.id)).filter((t) => t.agent_id === id);

  return (
    <>
      <PageHeader title={agent.name} description={agent.title} />
      <Card>
        <AgentForm slug={slug} agent={agent} />
      </Card>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>Tugas {agent.name}</SectionTitle>
          <Button asChild size="sm" variant="secondary">
            <Link href={`/o/${slug}/tugas?agent=${id}`}>Tambah tugas</Link>
          </Button>
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada tugas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-text">{t.name}</span>
                  <span className="text-xs font-normal text-text-muted">{scheduleLabel(t)}</span>
                </span>
                {!t.enabled && <StatusPill tone="offline">Nonaktif</StatusPill>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
