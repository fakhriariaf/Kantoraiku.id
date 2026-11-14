import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  neutral: "bg-surface-2 text-text-2",
  outline: "border border-border bg-surface text-text-2",
  tag: "rounded-sm border border-border-strong px-1.5 font-mono text-eyebrow uppercase text-text-muted",
} as const;

export function Chip({
  variant = "neutral",
  onRemove,
  icon,
  className,
  children,
}: {
  variant?: keyof typeof variants;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-pill px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5",
        variants[variant],
        className,
      )}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Hapus ${typeof children === "string" ? children : ""}`.trim()}
          className="-mr-1 ml-0.5 inline-flex size-5 items-center justify-center rounded-pill text-text-muted hover:bg-border hover:text-text"
        >
          <X aria-hidden />
        </button>
      )}
    </span>
  );
}
