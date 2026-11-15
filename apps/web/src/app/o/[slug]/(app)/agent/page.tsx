import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { AgentCard } from "@/components/kantor/agent-card";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listAgents, listTasks } from "@/server/office";
import { scheduleLabel } from "@/lib/format";
import { characterFor, ROBOT_URL, spriteUrl } from "@/lib/office-map";
import { archive } from "./actions";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ baru?: string }> };

const BRAIN = { simulation: "Simulasi", openai: "OpenAI", claude: "Claude" } as const;

export default function AgentsPage(props: P) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-60 rounded-xl" />)}
        </div>
      }
    >
      <Agents {...props} />
    </Suspense>
  );
}

async function Agents({ params, searchParams }: P) {
  const [{ slug }, { baru }] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const [agents, tasks] = await Promise.all([listAgents(office.id), listTasks(office.id)]);
  const created = baru ? agents.find((a) => a.id === baru) : null;

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      <PageHeader
        title="Agent"
        description="Karyawan AI kamu: nama, jabatan, job desk, dan otak AI-nya."
        actions={
          <Button asChild>
            <Link href={`/o/${slug}/agent/baru`}>
              <Plus aria-hidden />
              Agent baru
            </Link>
          </Button>
        }
      />
      {created && (
        <Banner
          tone="success"
          title={`${created.name} sudah bergabung`}
          action={<Button asChild size="sm" variant="secondary"><Link href={`/o/${slug}/tugas?agent=${created.id}`}>Beri tugas</Link></Button>}
        >
          Langkah berikutnya: beri {created.name} tugas supaya mulai bekerja.
        </Banner>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => {
          const mine = tasks.filter((t) => t.agent_id === a.id && t.enabled);
          const schedule =
            a.kind === "assistant"
              ? "Segera hadir: setup lewat chat"
              : mine.length === 0
                ? "Belum ada tugas"
                : mine.length === 1
                  ? scheduleLabel(mine[0])
                  : `${mine.length} tugas · ${scheduleLabel(mine[0])}`;
          return (
            <AgentCard
              key={a.id}
              id={a.id}
              name={a.name}
              title={a.title}
              portrait={a.kind === "assistant" ? ROBOT_URL : spriteUrl(characterFor(a.id, a.appearance), "berdiri")}
              status={a.status}
              skills={a.skills}
              schedule={schedule}
              builtin={a.kind === "assistant"}
              brainLabel={a.kind === "custom" ? BRAIN[a.brain] : undefined}
              editHref={a.kind === "custom" ? `/o/${slug}/agent/${a.id}` : undefined}
              archiveAction={a.kind === "custom" ? archive.bind(null, slug, a.id) : undefined}
            />
          );
        })}
      </div>
    </>
  );
}
