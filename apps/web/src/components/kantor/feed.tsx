import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type FeedEvent = {
  id: string;
  agentId: string;
  agentName: string;
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
      <Avatar name={e.agentName} seed={e.agentId} size="sm" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-text">
          <span className="font-semibold">{e.agentName}</span> {e.text}
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
