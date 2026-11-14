import { cn } from "@/lib/cn";

const tones = {
  working: { box: "bg-success-soft text-success", dot: "bg-success", label: "Bekerja", pulse: true },
  waiting: { box: "bg-warning-soft text-warning", dot: "bg-warning-dot", label: "Menunggu kamu" },
  ready: { box: "bg-surface-2 text-text-muted", dot: "bg-text-muted", label: "Siap" },
  error: { box: "bg-danger-soft text-danger", dot: "bg-danger", label: "Bermasalah" },
  online: { box: "bg-success-soft text-success", dot: "bg-success", label: "Online" },
  offline: { box: "bg-surface-2 text-text-muted", dot: "bg-text-muted", label: "Offline" },
  available: { box: "bg-success-soft text-success", dot: "bg-success", label: "Tersedia" },
  soon: { box: "bg-warning-soft text-warning", dot: "bg-warning-dot", label: "Segera" },
  info: { box: "bg-info-soft text-info", dot: "bg-info", label: "Info" },
} as const;

export type StatusTone = keyof typeof tones;

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  /** Ganti label bawaan, mis. "Lunas" atau "Menunggu bayar". */
  children?: React.ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-pill px-2 text-xs font-semibold whitespace-nowrap",
        t.box,
        className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        {"pulse" in t && <span className={cn("absolute inline-flex size-full animate-ping rounded-pill opacity-60", t.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-pill", t.dot)} />
      </span>
      {children ?? t.label}
    </span>
  );
}
