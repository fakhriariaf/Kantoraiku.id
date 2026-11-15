import Link from "next/link";
import { cn } from "@/lib/cn";

export type LinkTab = { href: string; label: string; count?: number; active: boolean };

/** Tab berupa tautan (tiap tab punya URL sendiri, bisa dibagikan dan di-bookmark). */
export function LinkTabs({ label, items, className }: { label: string; items: LinkTab[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-1 overflow-x-auto px-1 [scrollbar-width:none]", className)}>
      <ul className="flex w-max gap-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                t.active ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-sm px-1.5 text-xs tabular-nums", t.active ? "bg-surface text-text" : "bg-surface-2 text-text-muted")}>
                  {t.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
