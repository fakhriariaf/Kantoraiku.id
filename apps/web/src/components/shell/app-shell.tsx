"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Bot, CalendarDays, CircleUser, FileText, Home, LogOut, Menu as MenuIcon, Settings, Tv } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { officeLogout } from "@/app/o/[slug]/actions";
import { AssistantLauncher } from "./assistant-panel";
import { Logo } from "./logo";

/**
 * Enam menu utama. `also` = halaman lain yang termasuk menu itu (URL lama tetap dipakai):
 * Skill dan Tugas ada di bawah Agent, Perangkat/Kunci/CS ada di bawah Pengaturan.
 */
const NAV = [
  { href: "", label: "Kantor", icon: Home, also: [] },
  { href: "/konten", label: "Konten", icon: FileText, also: ["/persetujuan"] },
  { href: "/jadwal", label: "Jadwal", icon: CalendarDays, also: [] },
  { href: "/channel", label: "Channel", icon: Tv, also: [] },
  { href: "/agent", label: "Agent", icon: Bot, also: ["/skill", "/tugas"] },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, also: ["/perangkat", "/kunci", "/cs"] },
] as const;

const MOBILE_MAIN = ["", "/konten", "/jadwal", "/agent"];

function useActive() {
  const { slug } = useParams<{ slug: string }>();
  const path = usePathname();
  const base = `/o/${slug}`;
  const under = (p: string) => path === base + p || path.startsWith(`${base}${p}/`);
  const isActive = (n: (typeof NAV)[number]) => (n.href === "" ? path === base : [n.href, ...n.also].some(under));
  return { slug, base, isActive };
}

/**
 * Kerangka dashboard: menu atas di desktop, bottom nav di HP. Asisten bisa dibuka dari mana pun (Ctrl J).
 * officeName datang dari server (slot ber-Suspense) supaya layout tetap statis.
 */
export function AppShell({ officeName, children }: { officeName: React.ReactNode; children: React.ReactNode }) {
  const { slug, base, isActive } = useActive();
  const logout = officeLogout.bind(null, slug);

  return (
    <div className="min-h-dvh">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Lewati ke konten
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:h-16 md:gap-4 md:px-8">
          <span className="hidden lg:inline-flex">
            <Logo />
          </span>
          <div className="min-w-0 truncate text-sm font-semibold text-text md:hidden lg:block lg:max-w-36 lg:border-l lg:border-border lg:pl-4 lg:font-normal lg:text-text-2">
            {officeName}
          </div>

          <nav aria-label="Menu utama" className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={base + n.href}
                aria-current={isActive(n) ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive(n) ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <AssistantLauncher slug={slug} />
            <Menu>
              <MenuTrigger
                aria-label="Akun"
                className="hidden size-10 items-center justify-center rounded-pill bg-surface-2 text-text-2 hover:text-text data-[state=open]:text-text md:inline-flex"
              >
                <CircleUser aria-hidden className="size-5" />
              </MenuTrigger>
              <MenuContent>
                <MenuItem asChild>
                  <Link href={`${base}/pengaturan/akun`}>
                    <CircleUser aria-hidden />
                    Akun
                  </Link>
                </MenuItem>
                <MenuItem icon={<LogOut aria-hidden />} onSelect={() => void logout()}>
                  Keluar
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      <div id="konten" className="min-w-0 pb-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] md:pb-0">
        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      {/* Bottom nav HP */}
      <nav
        aria-label="Menu kantor"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV.filter((n) => MOBILE_MAIN.includes(n.href)).map((n) => (
          <Link
            key={n.href}
            href={base + n.href}
            aria-current={isActive(n) ? "page" : undefined}
            className={cn("flex flex-col items-center justify-center gap-1 text-xs font-semibold", isActive(n) ? "text-accent" : "text-text-muted")}
          >
            <n.icon aria-hidden className="size-5" />
            {n.label}
          </Link>
        ))}
        <Menu>
          <MenuTrigger
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs font-semibold data-[state=open]:text-text",
              NAV.some((n) => !MOBILE_MAIN.includes(n.href) && isActive(n)) ? "text-accent" : "text-text-muted",
            )}
          >
            <MenuIcon aria-hidden className="size-5" />
            Lainnya
          </MenuTrigger>
          <MenuContent>
            {NAV.filter((n) => !MOBILE_MAIN.includes(n.href)).map((n) => (
              <MenuItem key={n.href} asChild>
                <Link href={base + n.href}>
                  <n.icon aria-hidden />
                  {n.label}
                </Link>
              </MenuItem>
            ))}
            <MenuItem asChild>
              <Link href={`${base}/pengaturan/akun`}>
                <CircleUser aria-hidden />
                Akun
              </Link>
            </MenuItem>
            <MenuItem icon={<LogOut aria-hidden />} onSelect={() => void logout()}>
              Keluar
            </MenuItem>
          </MenuContent>
        </Menu>
      </nav>
    </div>
  );
}
