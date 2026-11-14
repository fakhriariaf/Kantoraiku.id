import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const banner = {
  info: { box: "bg-info-soft border-info", icon: <Info aria-hidden className="text-info" /> },
  warning: { box: "bg-warning-soft border-warning-dot", icon: <AlertTriangle aria-hidden className="text-warning" /> },
  danger: { box: "bg-danger-soft border-danger", icon: <XCircle aria-hidden className="text-danger" /> },
  success: { box: "bg-success-soft border-success", icon: <CheckCircle2 aria-hidden className="text-success" /> },
} as const;

export function Banner({
  tone = "info",
  title,
  action,
  className,
  children,
}: {
  tone?: keyof typeof banner;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const b = banner[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-3 rounded-lg border-l-[3px] p-4 sm:flex-row sm:items-center [&_svg]:size-5 [&_svg]:shrink-0",
        b.box,
        className,
      )}
    >
      <div className="flex flex-1 gap-3">
        {b.icon}
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-text">{title}</p>
          {children && <div className="text-sm text-text-2">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 pl-8 sm:pl-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-surface-2 text-text-muted [&_svg]:size-5">
        {icon}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-base font-semibold text-text">{title}</p>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}
