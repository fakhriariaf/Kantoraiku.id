import Link from "next/link";
import { Building2 } from "lucide-react";

/** Logo sementara (teks + ikon Lucide) sampai /replica-brand menghasilkan logo sendiri. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 text-base font-bold text-text">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-accent text-on-accent">
        <Building2 aria-hidden className="size-4" />
      </span>
      Kantoraiku
    </Link>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-header max-w-page items-center justify-between px-(--k-gutter)">
        <Logo />
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

export function PublicFooter() {
  return (
    <footer className="border-t border-border py-8 text-center text-xs font-normal text-text-muted">
      © Kantoraiku. Halaman legal menyusul sebelum peluncuran.
    </footer>
  );
}
