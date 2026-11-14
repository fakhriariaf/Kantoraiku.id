"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Bot, CalendarDays, CheckSquare, Home, ListChecks, LogOut, Menu as MenuIcon, Monitor, Sparkles, Tv } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { officeLogout } from "@/app/o/[slug]/actions";
import { Logo } from "./logo";

const NAV = [
  { href: "", label: "Kantor", icon: Home },
  { href: "/persetujuan", label: "Persetujuan", icon: CheckSquare },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/skill", label: "Skill", icon: Sparkles },
  { href: "/tugas", label: "Tugas", icon: ListChecks },
  { href: "/channel", label: "Channel", icon: Tv },
  { href: "/jadwal", label: "Jadwal", icon: CalendarDays },
  { href: "/perangkat", label: "Perangkat", icon: Monitor },
];

const MOBILE_MAIN = ["", "/persetujuan", "/agent", "/tugas"];

function useActive() {
  const { slug } = useParams<{ slug: string }>();
  const path = usePathname();
  const base = `/o/${slug}`;
  const isActive = (href: string) => (href === "" ? path === base : path.startsWith(base + href));
  return { slug, base, isActive };
}

/**
 * Kerangka dashboard: sidebar di desktop, bottom nav di HP.
 * officeName datang dari server (slot ber-Suspense) supaya layout tetap statis.
 */
export function AppShell({ officeName, children }: { officeName: React.ReactNode; children: React.ReactNode }) {
  const { slug, base, isActive } = useActive();
  const logout = officeLogout.bind(null, slug);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[var(--spacing-sidebar)_1fr]">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Lewati ke konten
      </a>

      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <Logo />
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-xs font-medium text-text-muted">Kantor</p>
          <div className="truncate text-sm font-semibold text-text">{officeName}</div>
        </div>
        <nav aria-label="Menu kantor" className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={base + href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
                isActive(href) ? "bg-accent-soft text-accent" : "text-text-2 hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-text-2 hover:bg-surface-2">
            <LogOut aria-hidden className="size-4" />
            Keluar
          </button>
        </form>
      </aside>

      {/* Header HP */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:hidden">
        <div className="min-w-0 truncate text-sm font-semibold text-text">{officeName}</div>
      </header>

      <div id="konten" className="min-w-0 pb-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] md:pb-0">
        <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {/* Bottom nav HP */}
      <nav
        aria-label="Menu kantor"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={base + href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs font-semibold", isActive(href) ? "text-accent" : "text-text-muted")}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        ))}
        <Menu>
          <MenuTrigger className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-text-muted data-[state=open]:text-text">
            <MenuIcon aria-hidden className="size-5" />
            Lainnya
          </MenuTrigger>
          <MenuContent>
            {NAV.filter((n) => !MOBILE_MAIN.includes(n.href)).map(({ href, label, icon: Icon }) => (
              <MenuItem key={href} asChild>
                <Link href={base + href}>
                  <Icon aria-hidden />
                  {label}
                </Link>
              </MenuItem>
            ))}
            <MenuItem icon={<LogOut aria-hidden />} onSelect={() => void logout()}>
              Keluar
            </MenuItem>
          </MenuContent>
        </Menu>
      </nav>
    </div>
  );
}
