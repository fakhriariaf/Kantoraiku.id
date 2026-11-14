import { Building2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type FeedEvent = {
  id: string;
  agentId: string;
  /** null = event sistem/kantor: kalimatnya sudah lengkap, tanpa nama di depan. */
  agentName: string | null;
  /** Kalimat setelah nama agent, mis. "selesai meriset 3 topik". */
  text: string;
  role: string;
  at: string; // ISO
  timeLabel: string; // "baru saja", "5 menit lalu"
  unread?: boolean;
};

export function FeedItem({ e, className }: { e: FeedEvent; className?: string }) {
  return (
    <div className={cn("relative flex gap-3", className)}>
      {e.unread && <span aria-hidden className="absolute top-3 -left-3 size-1.5 rounded-pill bg-accent" />}
      {e.agentName ? (
        <Avatar name={e.agentName} seed={e.agentId} size="sm" />
      ) : (
        <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-text-muted">
          <Building2 className="size-3.5" />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-text">
          {e.agentName && <span className="font-semibold">{e.agentName} </span>}
          {e.text}
          {e.unread && <span className="sr-only"> (baru)</span>}
        </p>
        <p className="text-xs font-normal text-text-muted">
          {e.role} · <time dateTime={e.at}>{e.timeLabel}</time>
        </p>
      </div>
    </div>
  );
}

export function Feed({ events }: { events: FeedEvent[] }) {
  return (
    <ol className="flex flex-col divide-y divide-border">
      {events.map((e) => (
        <li key={e.id} className="py-3 pl-3 first:pt-0 last:pb-0">
          <FeedItem e={e} />
        </li>
      ))}
    </ol>
  );
}

/** Toast aktivitas yang melayang di atas denah kantor (S11). */
export function ActivityToast({ e, office }: { e: FeedEvent; office: string }) {
  return (
    <div aria-live="polite" className="w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-pop">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-text-muted">
        <span>Aktivitas kantor</span>
        <span>{office}</span>
      </div>
      <FeedItem e={e} />
    </div>
  );
}
