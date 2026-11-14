import Link from "next/link";
import { config, hasRealWhatsapp } from "@/server/config";
import { Logo } from "./logo";

export { Logo };

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-header max-w-page items-center justify-between px-(--k-gutter)">
        <Logo />
        <nav aria-label="Bagian halaman" className="hidden items-center gap-1 md:flex">
          {[
            ["/#cara-kerja", "Cara kerja"],
            ["/#harga", "Harga"],
            ["/#faq", "Tanya jawab"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium text-text-2 hover:bg-surface-2 hover:text-text">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Akun" className="flex items-center gap-2">
          <Link href="/masuk" className="rounded-md px-3 py-2 text-sm font-semibold text-text-2 hover:bg-surface-2">
            Masuk
          </Link>
          <Link
            href="/beli"
            className="inline-flex h-control-sm items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            Mulai
          </Link>
        </nav>
      </div>
    </header>
  );
}

export const legalLinks = [
  { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
  { href: "/kebijakan-privasi", label: "Kebijakan Privasi" },
  { href: "/kebijakan-refund", label: "Kebijakan Refund" },
];

export function PublicFooter() {
  const wa = hasRealWhatsapp() ? config.adminWhatsapp : null;
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-page gap-8 px-(--k-gutter) py-10 sm:grid-cols-[1fr_auto_auto] sm:gap-12">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-text-muted">Kantor AI untuk konten kamu, berjalan di PC kamu sendiri.</p>
        </div>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-text">Legal</p>
          {legalLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-text-2 hover:text-text hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-text">Bantuan</p>
          <a href={`mailto:${config.supportEmail}`} className="text-text-2 hover:text-text hover:underline">
            {config.supportEmail}
          </a>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="text-text-2 hover:text-text hover:underline">
              WhatsApp +{wa}
            </a>
          )}
          <Link href="/masuk" className="text-text-2 hover:text-text hover:underline">
            Masuk ke kantor
          </Link>
        </div>
      </div>
      <p className="border-t border-border py-4 text-center text-xs font-normal text-text-muted">© Kantoraiku</p>
    </footer>
  );
}
