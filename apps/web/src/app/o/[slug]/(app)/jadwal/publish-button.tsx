"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { publishAction } from "./actions";

/** Tandai video sudah diposting. Posting otomatis (Repliz) menyusul; sampai itu pemilik memposting sendiri dari PC. */
export function PublishButton({ slug, contentId, title, size = "sm" }: { slug: string; contentId: string; title: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const call = useServerCall();

  const submit = () =>
    start(async () => {
      const r = await call(() => publishAction(slug, contentId, url));
      if (!r) return;
      if ("error" in r && r.error) {
        setError(r.error);
        return;
      }
      setOpen(false);
      toast({ title: "Ditandai sudah diposting", tone: "success" });
      router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant="secondary" aria-label={`Tandai sudah diposting: ${title}`}>
          <Send aria-hidden />
          Tandai sudah diposting
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Tandai sudah diposting"
        description="Unggah video dari PC kamu ke platform, lalu tandai di sini supaya jadwal tetap rapi. Posting otomatis segera hadir."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Batal</Button>
            </DialogClose>
            <Button loading={pending} onClick={submit}>
              Tandai
            </Button>
          </>
        }
      >
        <Field label="Link postingan" optional hint="Mis. link video TikTok atau YouTube Shorts-nya." error={error}>
          {(p) => <Input {...p} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}
        </Field>
      </DialogContent>
    </Dialog>
  );
}
