import Link from "next/link";

// Sementara: landing page dibangun di /replica-build (S01).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-page flex-col items-start justify-center gap-4 px-(--k-gutter)">
      <p className="font-mono text-eyebrow uppercase text-text-muted">Kantoraiku</p>
      <h1 className="text-display">Kantor AI untuk konten dan CS kamu.</h1>
      <Link href="/design" className="text-sm font-semibold text-accent underline underline-offset-4">
        Lihat sistem desain
      </Link>
    </main>
  );
}
