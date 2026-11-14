import { cn } from "@/lib/cn";

// String utuh supaya Tailwind menemukannya saat scan.
const COLORS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
  "bg-avatar-8",
];

const sizes = { sm: "size-7 text-xs", md: "size-9 text-xs", lg: "size-12 text-sm" } as const;

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2);
  return s.toUpperCase();
}

/** Warna stabil dari id/nama: agent yang sama selalu warna yang sama. */
export function avatarColor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export function Avatar({
  name,
  seed,
  size = "md",
  decorative = true,
  className,
}: {
  name: string;
  seed?: string;
  size?: keyof typeof sizes;
  /** true bila nama sudah tampil di sebelahnya. */
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : name}
      role={decorative ? undefined : "img"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-pill font-bold text-on-accent select-none",
        avatarColor(seed ?? name),
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
