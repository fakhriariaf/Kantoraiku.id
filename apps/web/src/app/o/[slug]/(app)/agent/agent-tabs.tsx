import { Suspense } from "react";
import { LinkTabs } from "@/components/shell/link-tabs";
import { requireMember } from "@/server/auth";
import { db, one } from "@/server/db";

type Active = "agent" | "skill" | "tugas";

function Tabs({ slug, active, counts }: { slug: string; active: Active; counts?: Record<Active, number> }) {
  const base = `/o/${slug}`;
  return (
    <LinkTabs
      label="Bagian Agent"
      items={[
        { href: `${base}/agent`, label: "Agent", count: counts?.agent, active: active === "agent" },
        { href: `${base}/skill`, label: "Skill", count: counts?.skill, active: active === "skill" },
        { href: `${base}/tugas`, label: "Tugas", count: counts?.tugas, active: active === "tugas" },
      ]}
    />
  );
}

async function Counted({ slug, active }: { slug: string; active: Active }) {
  const { office } = await requireMember(slug);
  const c = await one<Record<Active, number>>(
    await db(),
    `select (select count(*)::int from public.agents where office_id = $1 and archived_at is null) as agent,
            (select count(*)::int from public.skills where office_id = $1) as skill,
            (select count(*)::int from public.tasks t join public.agents a on a.id = t.agent_id
              where t.office_id = $1 and a.archived_at is null) as tugas`,
    [office.id],
  );
  return <Tabs slug={slug} active={active} counts={c ?? undefined} />;
}

/** Agent, Skill, dan Tugas dikelompokkan di satu menu Agent; URL lama tetap dipakai. */
export function AgentTabs({ slug, active }: { slug: string; active: Active }) {
  return (
    <Suspense fallback={<Tabs slug={slug} active={active} />}>
      <Counted slug={slug} active={active} />
    </Suspense>
  );
}

/** Untuk halaman yang slug-nya masih berupa Promise di luar Suspense. */
export async function AgentTabsFor({ params, active }: { params: Promise<{ slug: string }>; active: Active }) {
  return <AgentTabs slug={(await params).slug} active={active} />;
}
