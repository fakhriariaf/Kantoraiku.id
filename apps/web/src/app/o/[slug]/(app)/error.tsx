"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pengaman terakhir: error tak terduga (mis. koneksi putus saat kirim formulir). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-start justify-center gap-4 px-(--k-gutter) py-12">
      <h1 className="text-2xl">Ada yang tidak beres</h1>
      <p className="text-sm text-text-2">Koneksi mungkin terputus, atau server sedang bermasalah. Data yang sudah tersimpan tetap aman.</p>
      <Button onClick={reset}>
        <RefreshCw aria-hidden />
        Coba lagi
      </Button>
    </main>
  );
}
