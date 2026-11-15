"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Building2, CircleUser, KeyRound, MessageCircle, Monitor } from "lucide-react";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "/pengaturan", label: "Kantor", icon: Building2, exact: true },
  { href: "/perangkat", label: "PC dan perangkat", icon: Monitor, exact: false },
  { href: "/kunci", label: "Kunci & layanan", icon: KeyRound, exact: false },
  { href: "/cs", label: "CS WhatsApp", icon: MessageCircle, exact: false },
  { href: "/pengaturan/akun", label: "Akun", icon: CircleUser, exact: false },
];

/** Daftar bagian Pengaturan: kolom kiri di desktop, baris yang bisa digeser di HP. */
export function SettingsNav() {
  const { slug } = useParams<{ slug: string }>();
  const path = usePathname();
  const base = `/o/${slug}`;
  const active = (href: string, exact: boolean) => path === base + href || (!exact && path.startsWith(`${base}${href}/`));

  return (
    <nav aria-label="Bagian pengaturan" className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
      <ul className="flex w-max gap-1 md:w-auto md:flex-col">
        {SECTIONS.map(({ href, label, icon: Icon, exact }) => (
          <li key={href}>
            <Link
              href={base + href}
              aria-current={active(href, exact) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-semibold whitespace-nowrap transition-colors",
                active(href, exact) ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 hidden border-t border-border pt-4 text-xs text-text-muted md:block">
        Tugas, jadwal, dan otak AI tiap agent diatur di{" "}
        <Link href={`${base}/agent`} className="font-semibold text-accent underline underline-offset-2">
          menu Agent
        </Link>
        .
      </p>
    </nav>
  );
}
