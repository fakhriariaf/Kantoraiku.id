"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { addChannel, changeMode, editChannel, type ChannelFormState } from "./actions";

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

/** Sampai 4 jam posting (jam lokal kantor). Kosong semua = tidak dijadwalkan otomatis. */
export function PostTimesField({ defaultTimes, error }: { defaultTimes: string[]; error?: string }) {
  const [count, setCount] = useState(Math.max(1, defaultTimes.length));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold text-text">Jam posting</legend>
      <p className="text-xs font-normal text-text-muted">
        Video yang kamu setujui otomatis masuk ke jam kosong berikutnya (WIB). Kosongkan bila belum mau dijadwalkan.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: count }, (_, i) => (
          <input
            key={i}
            type="time"
            name="post_times"
            aria-label={`Jam posting ${i + 1}`}
            defaultValue={defaultTimes[i] ?? ""}
            className="h-control-md rounded-md border border-border-input bg-surface px-3 text-base text-text"
          />
        ))}
        {count < 4 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setCount(count + 1)}>
            Tambah jam
          </Button>
        )}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
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
      <PostTimesField key={state.ok ?? 0} defaultTimes={state.postTimes ?? []} error={state.errors?.post_times} />
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

export function EditChannelForm({
  slug,
  channel,
}: {
  slug: string;
  channel: { id: string; name: string; niche: string; content_language: string; post_times: string[] };
}) {
  const [state, action, pending] = useActionState<ChannelFormState, FormData>(editChannel.bind(null, slug, channel.id), {});
  const v = state.values;
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama channel" error={state.errors?.name}>
          {(p) => <Input {...p} name="name" maxLength={80} required defaultValue={v?.name ?? channel.name} />}
        </Field>
        <Field label="Bahasa konten">
          {(p) => (
            <Select {...p} name="content_language" defaultValue={v?.content_language ?? channel.content_language}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Niche dan gaya" hint="Siapa penontonnya, topik apa, nada bicara." error={state.errors?.niche}>
        {(p) => <Textarea {...p} name="niche" rows={3} defaultValue={v?.niche ?? channel.niche} />}
      </Field>
      <PostTimesField defaultTimes={state.postTimes ?? channel.post_times} error={state.errors?.post_times} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary">
          <Link href={`/o/${slug}/channel`}>Batal</Link>
        </Button>
        <Button type="submit" loading={pending}>
          Simpan perubahan
        </Button>
      </div>
    </form>
  );
}
