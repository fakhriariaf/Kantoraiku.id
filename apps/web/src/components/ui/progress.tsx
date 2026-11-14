import { cn } from "@/lib/cn";

/**
 * determinate: render video (%).
 * meter: anggaran AI; hijau < 80%, amber >= 80%, merah >= 100%.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  variant = "determinate",
  className,
}: {
  value: number;
  max?: number;
  label: string;
  variant?: "determinate" | "meter";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill =
    variant === "meter" ? (pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning-dot" : "bg-success") : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-surface-2", className)}
    >
      <div className={cn("h-full rounded-pill transition-[width] duration-300", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
