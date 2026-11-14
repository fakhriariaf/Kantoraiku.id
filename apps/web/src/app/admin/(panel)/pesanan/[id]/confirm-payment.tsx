"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cancel, confirmPayment, type ConfirmState } from "../../../actions";

export function ConfirmPayment({ orderId, code, amount, expired }: { orderId: string; code: string; amount: string; expired: boolean }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmPayment.bind(null, orderId), {});
  const [open, setOpen] = useState(false);

  return (
    <Card variant="flat" className="flex flex-col gap-3">
      <p className="text-sm text-text-2">
        Cek mutasi rekening: ada transfer <b>{amount}</b> dengan berita <span className="font-mono">{code}</span>?
        {expired && " Pesanan ini sudah lewat batas waktu; konfirmasi tetap bisa bila alamatnya masih bebas."}
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <CheckCircle2 aria-hidden />
            Tandai lunas
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Konfirmasi pembayaran?"
          description={`Kantor untuk pesanan ${code} langsung dibuat. Langkah ini tidak bisa dibatalkan dari panel.`}
        >
          <form action={action} className="flex flex-col gap-4">
            <Field label="Catatan" optional hint="Mis. nama bank pengirim dan jam transfer.">
              {(p) => <Textarea {...p} name="note" rows={3} />}
            </Field>
            {state.error && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
            <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <DialogClose asChild>
                <Button variant="secondary">Batal</Button>
              </DialogClose>
              <Button type="submit" loading={pending}>Ya, tandai lunas</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <form action={cancel.bind(null, orderId)}>
        <Button type="submit" variant="danger-ghost" className="w-full">Batalkan pesanan</Button>
      </form>
    </Card>
  );
}
