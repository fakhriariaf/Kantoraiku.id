"use client";

import { useState, useTransition } from "react";
import { Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetupCode } from "@/components/kantor/device";
import { timeOnly } from "@/lib/format";
import { useServerCall } from "@/lib/use-server-call";
import { newSetupCode } from "./actions";

/**
 * Langkah memasang konektor: unduh aplikasi Windows, buat kode setup, tempel di aplikasi.
 * server: alamat yang harus diisi di aplikasi bila bukan alamat bawaan (mis. saat pengembangan).
 */
export function SetupPanel({ slug, server, defaultServer, downloadUrl }: { slug: string; server: string; defaultServer: string; downloadUrl: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pending, start] = useTransition();
  const call = useServerCall();
  const customServer = server !== defaultServer;

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Sambungkan PC</h2>
        <p className="text-sm text-text-2">
          Aplikasi Kantoraiku menjalankan agent di PC kamu. Kunci API kamu tetap di PC, tidak bisa dibaca server.
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm text-text-2 marker:font-semibold marker:text-text">
        <li className="flex flex-col gap-2">
          <span>Unduh dan pasang Kantoraiku untuk Windows (Windows 10/11, 64-bit, tanpa hak admin).</span>
          <Button asChild variant="secondary" className="self-start">
            <a href={downloadUrl} rel="noopener">
              <Download aria-hidden />
              Unduh untuk Windows
            </a>
          </Button>
          <span className="text-xs text-text-muted">
            Kalau Windows menampilkan &quot;Windows melindungi PC Anda&quot;, pilih <strong>Info selengkapnya</strong> lalu{" "}
            <strong>Tetap jalankan</strong>. Peringatan ini hilang setelah installer kami bertanda tangan digital.
          </span>
        </li>
        <li className="flex flex-col gap-2">
          <span>Buat kode setup (berlaku 1 jam, sekali pakai).</span>
          {code ? (
            <SetupCode code={code.code} expiresIn={`sampai ${timeOnly(code.expiresAt)}`} />
          ) : (
            <Button className="self-start" loading={pending} onClick={() => start(async () => setCode((await call(() => newSetupCode(slug))) ?? null))}>
              <KeyRound aria-hidden />
              Buat kode setup
            </Button>
          )}
        </li>
        <li className="flex flex-col gap-1">
          <span>
            Buka aplikasi Kantoraiku di PC, tempel kodenya, lalu tekan <strong>Sambungkan</strong>. PC akan muncul di halaman ini.
          </span>
          {customServer && (
            <span className="text-xs text-text-muted">
              Di <strong>Pengaturan lanjutan</strong> aplikasi, isi alamat server <code className="font-mono">{server}</code>.
            </span>
          )}
        </li>
      </ol>

      <details className="text-sm text-text-2">
        <summary className="cursor-pointer font-semibold text-text">Untuk pengembang: konektor lewat terminal</summary>
        <div className="mt-3 flex flex-col gap-2">
          <span>Dari folder proyek Kantoraiku, pasangkan lalu jalankan konektor CLI:</span>
          <pre className="overflow-x-auto rounded-lg bg-surface-inverse p-3 font-mono text-xs leading-5 text-on-inverse">
            <code>{`pnpm --filter @kantoraiku/runner pair ${code?.code ?? "KODE"} --server ${server}\npnpm --filter @kantoraiku/runner start`}</code>
          </pre>
          <span className="text-xs text-text-muted">
            Kunci API bisa diisi di <code className="font-mono">packages/runner/.env</code> atau di menu Kunci.
          </span>
        </div>
      </details>
    </Card>
  );
}
