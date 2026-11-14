import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-accent text-on-accent shadow-xs hover:bg-accent-hover",
  secondary: "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
  danger: "bg-danger text-on-danger hover:brightness-95",
  "danger-ghost": "text-danger hover:bg-danger-soft",
} as const;

const sizes = {
  sm: "h-control-sm gap-1.5 px-3 text-sm",
  md: "h-control-md gap-2 px-4 text-sm",
  lg: "h-control-lg gap-2 px-5 text-base",
  icon: "size-control-md",
  "icon-sm": "size-control-sm",
} as const;

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  /** Render sebagai child (mis. <Link>) dengan gaya tombol. */
  asChild?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  asChild = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const cls = cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-semibold transition-[background-color,border-color,color,filter] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild) {
    return (
      <Slot.Root className={cls} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
