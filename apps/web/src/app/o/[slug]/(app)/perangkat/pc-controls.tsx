"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { SetupCode } from "@/components/kantor/device";
import { timeOnly } from "@/lib/format";
import { useServerCall } from "@/lib/use-server-call";
import { replaceCodeAction, setVideoAction } from "./actions";

/** "Pakai untuk video": PC ini mengambil tugas video (render). Mati = hanya tugas agent biasa. */
export function VideoToggle({ slug, deviceId, name, on }: { slug: string; deviceId: string; name: string; on: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  return (
    <Switch
      label="Pakai untuk video"
      description={value ? "PC ini menerima tugas membuat video." : "PC ini hanya menjalankan agent, tidak membuat video."}
      checked={value}
      disabled={pending}
      onCheckedChange={(next) => {
        setValue(next);
        start(async () => {
          const r = await call(() => setVideoAction(slug, deviceId, next));
          if (!r?.ok) {
            setValue(!next);
            if (r?.error) toast({ title: r.error, tone: "error" });
            return;
          }
          toast({ title: next ? `${name} dipakai untuk video` : `${name} tidak lagi membuat video`, tone: "success" });
        });
      }}
    />
  );
}

/**
 * Ganti PC saat slot penuh: pilih PC yang diganti, dapat kode setup. PC lama tetap jalan
 * sampai PC baru tersambung dengan kode itu, lalu dicabut otomatis.
 */
export function ReplacePc({ slug, pcs }: { slug: string; pcs: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(pcs[0]?.id ?? "");
  const [code, setCode] = useState<{ code: string; expiresAt: string; replaces: string } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const call = useServerCall();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setCode(null);
          setError(undefined);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="self-start">
          <ArrowLeftRight aria-hidden />
          Ganti PC
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Ganti PC"
        description="Pilih PC yang diganti. PC itu tetap bekerja sampai PC baru tersambung dengan kode di bawah, lalu dicabut otomatis."
        footer={
          code ? (
            <DialogClose asChild>
              <Button>Selesai</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="secondary">Batal</Button>
              </DialogClose>
              <Button
                loading={pending}
                disabled={!picked}
                onClick={() =>
                  start(async () => {
                    const r = await call(() => replaceCodeAction(slug, picked));
                    if (!r) return;
                    if (!r.ok || !r.code || !r.expiresAt || !r.replaces) return setError(r.error ?? "Kode gagal dibuat.");
                    setCode({ code: r.code, expiresAt: r.expiresAt, replaces: r.replaces });
                  })
                }
              >
                Buat kode
              </Button>
            </>
          )
        }
      >
        {code ? (
          <div className="flex flex-col gap-3 text-sm text-text-2">
            <SetupCode code={code.code} expiresIn={`sampai ${timeOnly(code.expiresAt)}`} />
            <p>
              Tempel kode ini di aplikasi Kantoraiku di PC baru. Begitu tersambung, <strong className="text-text">{code.replaces}</strong> dicabut dan
              tugasnya dikembalikan ke antrean.
            </p>
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-text">PC yang diganti</legend>
            {pcs.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
              >
                <input type="radio" name="pc" value={p.id} checked={picked === p.id} onChange={() => setPicked(p.id)} className="accent-accent" />
                <span className="text-text">{p.name}</span>
              </label>
            ))}
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
          </fieldset>
        )}
      </DialogContent>
    </Dialog>
  );
}
