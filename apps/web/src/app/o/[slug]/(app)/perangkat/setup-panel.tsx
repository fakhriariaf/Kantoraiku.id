"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SetupCode } from "@/components/kantor/device";
import { timeOnly } from "@/lib/format";
import { newSetupCode } from "./actions";

/** Langkah memasang konektor (versi dev: CLI dari repo). Installer Windows menyusul di Fase 1 lanjutan. */
export function SetupPanel({ slug, server }: { slug: string; server: string }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">Sambungkan PC</h2>
        <p className="text-sm text-text-2">
          Konektor menjalankan agent di PC kamu. Kunci API kamu tetap di PC, tidak dikirim ke server.
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm text-text-2 marker:font-semibold marker:text-text">
        <li className="flex flex-col gap-2">
          <span>Buat kode setup (berlaku 1 jam, sekali pakai).</span>
          {code ? (
            <SetupCode code={code.code} expiresIn={`sampai ${timeOnly(code.expiresAt)}`} />
          ) : (
            <Button className="self-start" loading={pending} onClick={() => start(async () => setCode(await newSetupCode(slug)))}>
              <KeyRound aria-hidden />
              Buat kode setup
            </Button>
          )}
        </li>
        <li className="flex flex-col gap-2">
          <span>Di PC, dari folder proyek Kantoraiku, pasangkan konektor:</span>
          <pre className="overflow-x-auto rounded-lg bg-surface-inverse p-3 font-mono text-xs leading-5 text-on-inverse">
            <code>{`pnpm --filter @kantoraiku/runner pair ${code?.code ?? "KODE"} --server ${server}`}</code>
          </pre>
        </li>
        <li className="flex flex-col gap-2">
          <span>
            Isi <code className="font-mono text-xs">OPENAI_API_KEY</code> di <code className="font-mono text-xs">packages/runner/.env</code> (opsional; agent simulasi tidak butuh), lalu jalankan:
          </span>
          <pre className="overflow-x-auto rounded-lg bg-surface-inverse p-3 font-mono text-xs leading-5 text-on-inverse">
            <code>pnpm --filter @kantoraiku/runner start</code>
          </pre>
        </li>
      </ol>
    </Card>
  );
}
