import Link from "next/link";
import { FileWarning } from "lucide-react";
import { Eyebrow } from "@/components/ui/card";
import { PublicFooter, PublicHeader, legalLinks } from "@/components/shell/public-header";
import { cn } from "@/lib/cn";
import { config } from "@/server/config";

/**
 * Status dokumen legal (S09). Ubah `draft` ke false dan isi `effectiveDate` setelah isinya
 * ditinjau dan LEGAL_ENTITY diisi. Selama draf, setiap halaman legal menampilkan peringatan.
 */
export const legalStatus = {
  draft: true,
  draftedAt: "14 November 2026",
  effectiveDate: null as string | null,
};

export function legalEntity() {
  return config.legalEntity || "[nama pemilik atau badan usaha]";
}

export function LegalPage({
  path,
  title,
  summary,
  children,
}: {
  path: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const isDraft = legalStatus.draft || !config.legalEntity;
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-(--k-gutter) py-12 md:py-16">
        <nav aria-label="Dokumen legal" className="flex flex-wrap gap-2">
          {legalLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === path ? "page" : undefined}
              className={cn(
                "rounded-pill border px-3 py-1.5 text-sm font-medium",
                l.href === path
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-2 hover:border-border-strong hover:text-text",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <header className="flex flex-col gap-3">
          <Eyebrow className="text-accent">Legal</Eyebrow>
          <h1 className="text-2xl">{title}</h1>
          <p className="text-base text-text-2">{summary}</p>
          <p className="text-sm text-text-muted">
            {legalStatus.effectiveDate
              ? `Berlaku sejak ${legalStatus.effectiveDate}.`
              : `Versi draf, disusun ${legalStatus.draftedAt}.`}
          </p>
        </header>

        {isDraft && (
          <div role="note" className="flex gap-3 rounded-xl border border-warning-dot bg-warning-soft p-4 text-sm text-text">
            <FileWarning aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <p>
              <strong className="font-semibold">Draf.</strong> Dokumen ini belum ditinjau ahli hukum dan belum berlaku.
              Identitas pengelola dan tanggal berlaku diisi sebelum Kantoraiku dibuka untuk umum.
            </p>
          </div>
        )}

        <article
          className={cn(
            "flex flex-col text-base text-text-2",
            "[&_h2]:mt-10 [&_h2]:text-lg [&_h2]:text-text [&>h2:first-child]:mt-0",
            "[&_p]:mt-3 [&_p]:leading-7",
            "[&_ul]:mt-3 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-6 [&_li]:leading-7",
            "[&_ol]:mt-3 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-6",
            "[&_strong]:font-semibold [&_strong]:text-text",
            "[&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
          )}
        >
          {children}
        </article>

        <section aria-labelledby="kontak-legal" className="rounded-xl border border-border bg-surface p-5">
          <h2 id="kontak-legal" className="text-base font-semibold text-text">
            Ada pertanyaan soal dokumen ini?
          </h2>
          <p className="mt-1 text-sm text-text-2">
            Kirim email ke{" "}
            <a href={`mailto:${config.supportEmail}`} className="font-semibold text-accent underline underline-offset-2">
              {config.supportEmail}
            </a>
            . Kami membalas di hari kerja.
          </p>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
