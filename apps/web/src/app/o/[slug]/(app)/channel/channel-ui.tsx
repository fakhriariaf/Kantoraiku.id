"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { addChannel, changeMode, type ChannelFormState } from "./actions";

const MODES = [
  { value: "manual" as const, label: "Manual" },
  { value: "auto" as const, label: "Otomatis" },
];

export function ModeSwitch({ slug, channelId, mode }: { slug: string; channelId: string; mode: "manual" | "auto" }) {
  const [value, setValue] = useState(mode);
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  return (
    <div className="flex flex-col gap-1.5" aria-busy={pending}>
      <SegmentedControl
        label="Mode channel"
        options={MODES}
        value={value}
        onValueChange={(m) => {
          setValue(m);
          start(async () => {
            const ok = await call(async () => {
              await changeMode(slug, channelId, m);
              return true;
            });
            if (!ok) return setValue(value); // kembalikan pilihan bila gagal tersimpan
            toast({ title: m === "auto" ? "Mode otomatis aktif" : "Mode manual aktif", tone: "success" });
          });
        }}
      />
      <p className="text-xs font-normal text-text-muted">
        {value === "manual" ? "Naskah menunggu persetujuanmu sebelum lanjut." : "Naskah langsung lanjut tanpa menunggu kamu."}
      </p>
    </div>
  );
}

export function NewChannelForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<ChannelFormState, FormData>(addChannel.bind(null, slug), {});
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const toast = useToast();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast({ title: "Channel dibuat", tone: "success" });
    }
  }, [state.ok, toast]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama channel" hint="Mis. Fakta Unik, Resep Kilat." error={state.errors?.name}>
          {(p) => <Input {...p} name="name" maxLength={80} required defaultValue={state.values?.name} />}
        </Field>
        <Field label="Bahasa konten">
          {(p) => (
            <Select {...p} name="content_language" defaultValue={state.values?.content_language ?? "id"}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Niche dan gaya" hint="Siapa penontonnya, topik apa, nada bicara. Agent memakai ini saat riset dan menulis." error={state.errors?.niche}>
        {(p) => <Textarea {...p} name="niche" rows={3} defaultValue={state.values?.niche} placeholder="Fakta sains sehari-hari untuk anak muda, santai dan lucu, 30-60 detik." />}
      </Field>
      <input type="hidden" name="mode" value={mode} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-text">Mode</span>
        <SegmentedControl label="Mode channel baru" options={MODES} value={mode} onValueChange={setMode} />
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Buat channel
      </Button>
    </form>
  );
}
