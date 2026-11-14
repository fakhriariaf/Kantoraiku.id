"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, Monitor, MoreHorizontal, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/ui/status-pill";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

export function DeviceCard({
  kind,
  name,
  status,
  lastSeen,
  capabilities,
  onCreateCode,
  revokeAction,
  footer,
}: {
  kind: "pc" | "vps";
  name?: string;
  status: "online" | "offline" | "not_installed";
  lastSeen?: string;
  capabilities?: string[];
  onCreateCode?: () => void;
  revokeAction?: () => Promise<void>;
  footer?: React.ReactNode;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const Icon = kind === "pc" ? Monitor : Server;
  const title = name ?? (kind === "pc" ? "PC kamu" : "VPS kamu");
  const notInstalled = status === "not_installed";

  return (
    <Card variant={notInstalled ? "dashed" : "flat"} className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-2">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">{title}</h3>
            <Chip variant="tag">{kind === "pc" ? "wajib" : "opsional"}</Chip>
          </div>
          {notInstalled ? (
            <StatusPill tone="offline">Belum dipasang</StatusPill>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={status} />
              {lastSeen && <span className="text-xs font-normal text-text-muted">Terakhir terlihat {lastSeen}</span>}
            </div>
          )}
        </div>
        {!notInstalled && revokeAction && (
          <Menu>
            <MenuTrigger
              aria-label={`Menu ${title}`}
              className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </MenuTrigger>
            <MenuContent>
              <MenuItem danger onSelect={() => setConfirm(true)}>Cabut perangkat</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>

      {capabilities && !notInstalled && (
        <ul className="flex flex-col gap-1 text-sm text-text-2">
          {capabilities.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <Check aria-hidden className="size-4 text-success" />
              {c}
            </li>
          ))}
        </ul>
      )}

      {notInstalled && onCreateCode && (
        <Button variant="secondary" onClick={onCreateCode} className="self-start">
          Buat kode setup
        </Button>
      )}
      {footer}

      {revokeAction && (
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent
            title={`Cabut ${title}?`}
            description="Perangkat ini tidak bisa lagi mengambil tugas. Tugas yang sedang jalan dikembalikan ke antrean. Untuk memakainya lagi, pasangkan ulang dengan kode setup baru."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary">Batal</Button>
                </DialogClose>
                <Button variant="danger" loading={pending} onClick={() => start(async () => { await revokeAction(); setConfirm(false); })}>
                  Cabut
                </Button>
              </>
            }
          />
        </Dialog>
      )}
    </Card>
  );
}

/** Kode setup sekali pakai: ditampilkan sekali, bisa disalin. */
export function SetupCode({ code, expiresIn }: { code: string; expiresIn: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const grouped = code.match(/.{1,4}/g)?.join(" ") ?? code;

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-text-muted">Kode setup · berlaku {expiresIn}</p>
        <p className="font-mono text-xl tracking-[0.12em] text-text" aria-label={`Kode setup ${code.split("").join(" ")}`}>
          {grouped}
        </p>
      </div>
      <Button
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
        }}
      >
        {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
        {copied ? "Tersalin" : "Salin"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Kode disalin" : ""}
      </span>
    </div>
  );
}
