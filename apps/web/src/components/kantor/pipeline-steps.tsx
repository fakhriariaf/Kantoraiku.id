import { Check, CircleDashed, Clapperboard, Hourglass, Loader2, PenLine, Search, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type StepState = "pending" | "active" | "done" | "waiting" | "failed" | "skipped";
export type Step = { key: string; label: string; state: StepState; detail?: string };

const stepIcon: Record<string, React.ReactNode> = {
  research: <Search aria-hidden />,
  script: <PenLine aria-hidden />,
  approval: <Check aria-hidden />,
  video: <Clapperboard aria-hidden />,
  publish: <Send aria-hidden />,
};

const stateStyle: Record<StepState, string> = {
  pending: "border-border bg-surface text-text-muted",
  active: "border-accent bg-accent-soft text-accent",
  done: "border-success bg-success text-on-accent",
  waiting: "border-warning-dot bg-warning-soft text-warning",
  failed: "border-danger bg-danger-soft text-danger",
  skipped: "border-dashed border-border-strong bg-surface text-text-muted",
};

const stateText: Record<StepState, string> = {
  pending: "belum mulai",
  active: "sedang berjalan",
  done: "selesai",
  waiting: "menunggu kamu",
  failed: "gagal",
  skipped: "dilewati",
};

function icon(s: Step) {
  if (s.state === "done") return <Check aria-hidden />;
  if (s.state === "failed") return <X aria-hidden />;
  if (s.state === "active") return <Loader2 aria-hidden className="animate-spin" />;
  if (s.state === "waiting") return <Hourglass aria-hidden />;
  if (s.state === "skipped") return <CircleDashed aria-hidden />;
  return stepIcon[s.key] ?? <CircleDashed aria-hidden />;
}

/** Vertikal di HP, horizontal mulai md. */
export function PipelineSteps({ steps, label = "Tahap konten" }: { steps: Step[]; label?: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-0 md:flex-row md:gap-2">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const current = s.state === "active" || s.state === "waiting";
        return (
          <li
            key={s.key}
            aria-current={current ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:gap-2 md:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 left-4 h-[calc(100%-2rem)] w-px md:top-4 md:left-10 md:h-px md:w-[calc(100%-2.5rem)]",
                  s.state === "done" ? "bg-success" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-pill border [&_svg]:size-4",
                stateStyle[s.state],
              )}
            >
              {icon(s)}
            </span>
            <div className="flex flex-col gap-0.5 pt-1 md:pt-0">
              <span className="text-sm font-semibold text-text">{s.label}</span>
              <span className={cn("text-xs font-normal", s.state === "waiting" ? "text-warning" : s.state === "failed" ? "text-danger" : "text-text-muted")}>
                {s.detail ?? stateText[s.state]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
