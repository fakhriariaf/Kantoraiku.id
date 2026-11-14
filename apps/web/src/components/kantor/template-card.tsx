import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Kartu template video 9:16 (Fase 2). Preview `src` berupa video milik Kantoraiku sendiri;
 * sampai ada, tampil sebagai bidang warna. Autoplay berhenti bila `paused` (tombol "Jeda gerakan")
 * atau prefers-reduced-motion (diatur pemanggil).
 */
export function TemplateCard({
  name,
  src,
  selected,
  paused,
  onSelect,
}: {
  name: string;
  src?: string;
  selected?: boolean;
  paused?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group flex w-36 shrink-0 flex-col gap-2 text-left sm:w-40",
      )}
    >
      <span
        className={cn(
          "relative block aspect-[9/16] w-full overflow-hidden rounded-xl border border-border bg-surface-2 shadow-xs transition-shadow group-hover:shadow-card",
          selected && "outline-2 outline-offset-2 outline-accent",
        )}
      >
        {src ? (
          <video aria-hidden src={src} muted loop playsInline autoPlay={!paused} className="size-full object-cover" />
        ) : (
          <span aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,var(--k-color-accent-soft),var(--k-color-surface-2))]" />
        )}
        {selected && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold text-accent shadow-xs">
            <CheckCircle2 aria-hidden className="size-3.5" />
            Dipakai
          </span>
        )}
      </span>
      <span className="text-sm font-medium text-text-2">{name}</span>
    </button>
  );
}
