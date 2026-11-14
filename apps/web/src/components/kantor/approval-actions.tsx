"use client";

import { useState } from "react";
import { Check, PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type Decision = "approve" | "revise" | "reject";

/**
 * Setujui / Revisi / Tolak. Revisi wajib catatan.
 * HP: menempel di bawah layar (sticky); desktop: sejajar.
 */
export function ApprovalActions({
  onDecide,
  decided,
  sticky = false,
}: {
  onDecide: (d: Decision, note?: string) => Promise<void> | void;
  decided?: { decision: Decision; at: string };
  sticky?: boolean;
}) {
  const [busy, setBusy] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const [open, setOpen] = useState(false);

  if (decided) {
    const label = { approve: "Disetujui", revise: "Diminta revisi", reject: "Ditolak" }[decided.decision];
    return (
      <p className="text-sm font-semibold text-text-2" role="status">
        {label} · {decided.at}
      </p>
    );
  }

  async function run(d: Decision, n?: string) {
    setBusy(d);
    try {
      await onDecide(d, n);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={cn(
        // Satu baris di HP supaya bar yang menempel di bawah tidak menutupi naskah.
        "flex flex-row gap-2 [&>*]:flex-1 [&>*]:px-2 sm:justify-end sm:[&>*]:flex-none sm:[&>*]:px-4",
        sticky &&
          "sticky bottom-0 -mx-4 border-t border-border bg-surface/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
      )}
    >
      <Button variant="danger-ghost" className="sm:order-1" loading={busy === "reject"} disabled={!!busy} onClick={() => run("reject")}>
        <X aria-hidden />
        Tolak
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" className="sm:order-2" disabled={!!busy}>
            <PenLine aria-hidden />
            Revisi
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Minta revisi"
          description="Tulis apa yang perlu diubah. Agent akan mengerjakan ulang memakai catatanmu."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary">Batal</Button>
              </DialogClose>
              <Button
                loading={busy === "revise"}
                onClick={async () => {
                  if (!note.trim()) return setNoteError("Catatan revisi wajib diisi.");
                  await run("revise", note.trim());
                  setOpen(false);
                }}
              >
                Kirim revisi
              </Button>
            </>
          }
        >
          <Field label="Catatan revisi" error={noteError}>
            {(p) => (
              <Textarea
                {...p}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setNoteError(undefined);
                }}
                placeholder="Contoh: pembukanya kurang kuat, mulai dengan pertanyaan."
              />
            )}
          </Field>
        </DialogContent>
      </Dialog>

      <Button className="sm:order-3" loading={busy === "approve"} disabled={!!busy} onClick={() => run("approve")}>
        <Check aria-hidden />
        Setujui
      </Button>
    </div>
  );
}
