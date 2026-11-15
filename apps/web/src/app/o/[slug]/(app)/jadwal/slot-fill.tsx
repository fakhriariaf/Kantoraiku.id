"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { fillSlotAction } from "./actions";

/** Slot jam posting kosong yang bisa diisi dengan video dari antrean channel itu. */
export function SlotFill({
  slug,
  channel,
  dayLabel,
  time,
  at,
  queue,
}: {
  slug: string;
  channel: string;
  dayLabel: string;
  time: string;
  at: string;
  queue: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(queue[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const call = useServerCall();
  const label = time.replace(":", ".");

  const submit = () =>
    start(async () => {
      const r = await call(() => fillSlotAction(slug, picked, at));
      if (!r) return;
      if ("error" in r && r.error) return setError(r.error);
      setOpen(false);
      toast({ title: `Dijadwalkan ${dayLabel} ${label}`, tone: "success" });
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setError(undefined))}>
      <DialogTrigger
        className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-accent px-2.5 py-2 text-left text-xs font-semibold text-accent transition-colors hover:bg-accent-soft"
      >
        <span className="font-mono">{label}</span>
        <span>
          Isi<span className="sr-only"> slot {channel} {dayLabel} dari antrean</span>
        </span>
      </DialogTrigger>
      <DialogContent
        title={`Isi slot ${dayLabel} ${label}`}
        description={`Pilih video dari antrean ${channel}. Video itu akan diposting di jam ini.`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Batal</Button>
            </DialogClose>
            <Button onClick={submit} loading={pending} disabled={!picked}>
              Jadwalkan
            </Button>
          </>
        }
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Video di antrean</legend>
          {queue.map((q) => (
            <label key={q.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="video" value={q.id} checked={picked === q.id} onChange={() => setPicked(q.id)} className="mt-0.5 accent-accent" />
              <span className="text-text">{q.title}</span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
