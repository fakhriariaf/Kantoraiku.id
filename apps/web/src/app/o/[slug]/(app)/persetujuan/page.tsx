import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listContents, listPendingApprovals } from "@/server/office";
import { relativeTime } from "@/lib/format";
import { STAGE } from "./stage";

type P = { params: Promise<{ slug: string }> };

export default function ApprovalsPage({ params }: P) {
  return (
    <>
      <PageHeader title="Persetujuan" description="Naskah yang menunggu keputusanmu: setujui, minta revisi, atau tolak." />
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <Approvals params={params} />
      </Suspense>
    </>
  );
}

async function Approvals({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const [pending, recent] = await Promise.all([listPendingApprovals(office.id), listContents(office.id, 10)]);
  const now = Date.now();
  const base = `/o/${slug}`;

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      {pending.length === 0 ? (
        <Card variant="flat">
          <EmptyState icon={<Inbox aria-hidden />} title="Tidak ada yang menunggu kamu" description="Naskah baru dari agent penulis akan muncul di sini." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((a) => (
            <li key={a.approval_id}>
              <Link
                href={`${base}/konten/${a.content_id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong"
              >
                {a.agent_name && <Avatar name={a.agent_name} seed={a.agent_id ?? a.agent_name} />}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="line-clamp-2 text-base font-semibold text-text">{a.title}</span>
                  <span className="text-xs font-normal text-text-muted">
                    {a.channel_name} · {a.agent_name ?? "agent"} · {a.word_count ?? 0} kata · {a.duration_s ?? 0} detik
                    {a.revision > 0 && ` · revisi ${a.revision}`} · {relativeTime(a.created_at, now)}
                  </span>
                  <StatusPill tone="waiting" className="self-start">Naskah menunggu kamu</StatusPill>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-3">
        <SectionTitle>Konten terbaru</SectionTitle>
        {recent.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada konten.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/konten/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/50">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-text">{c.title}</span>
                    <span className="text-xs font-normal text-text-muted">{c.channel_name} · {relativeTime(c.created_at, now)}</span>
                  </span>
                  <StatusPill tone={STAGE[c.stage]?.tone ?? "ready"}>{STAGE[c.stage]?.label ?? c.stage}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
