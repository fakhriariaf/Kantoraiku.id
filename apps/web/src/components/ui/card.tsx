import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  default: "border border-border bg-surface shadow-card",
  flat: "border border-border bg-surface",
  dashed: "border border-dashed border-border-strong bg-transparent",
} as const;

export function Card({
  variant = "default",
  className,
  ...props
}: React.ComponentProps<"div"> & { variant?: keyof typeof variants }) {
  return <div className={cn("rounded-xl p-4 md:p-5", variants[variant], className)} {...props} />;
}

/** Kartu putus-putus "buat baru". Satu tombol untuk seluruh kartu. */
export function AddCard({
  title,
  description,
  className,
  ...props
}: React.ComponentProps<"button"> & { title: string; description?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-40 w-full flex-col items-start justify-center gap-3 rounded-xl border border-dashed border-border-strong p-5 text-left transition-colors hover:border-accent hover:bg-surface",
        className,
      )}
      {...props}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-pill bg-accent-soft text-accent">
        <Plus aria-hidden className="size-4" />
      </span>
      <span className="text-base font-semibold text-text">{title}</span>
      {description && <span className="text-sm text-text-muted">{description}</span>}
    </button>
  );
}

export function Eyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("font-mono text-eyebrow uppercase text-text-muted", className)} {...props} />;
}
