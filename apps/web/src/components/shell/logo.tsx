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
