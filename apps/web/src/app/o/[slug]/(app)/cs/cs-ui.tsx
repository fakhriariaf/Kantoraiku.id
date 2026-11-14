"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { chooseAgent, handOver, reply, saveInfo, simulate, simulateInThread, type FormState } from "./actions";

/** Pilih agent CS untuk satu koneksi; tersimpan langsung saat diganti. */
export function AgentPicker({
  slug,
  connectionId,
  label,
  agents,
  current,
}: {
  slug: string;
  connectionId: string;
  label: string;
  agents: { id: string; name: string }[];
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  return (
    <Field label={label} hint="Agent ini membalas otomatis memakai info bisnis. Kosongkan untuk membalas sendiri.">
      {(p) => (
        <Select
          {...p}
          value={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            const prev = value;
            setValue(next);
            start(async () => {
              const r = await call(() => chooseAgent(slug, connectionId, next));
              if (!r || ("error" in r && r.error)) {
                setValue(prev);
                if (r && "error" in r) toast({ title: r.error, tone: "error" });
                return;
              }
              toast({ title: next ? "Agent CS tersimpan" : "Balasan otomatis dimatikan", tone: "success" });
            });
          }}
        >
          <option value="">Tidak ada (balas sendiri)</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function SimulatorForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(simulate.bind(null, slug), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nama pelanggan" hint="Bebas, mis. Rina. Nama yang sama melanjutkan percakapan yang sama.">
        {(p) => <Input {...p} name="name" maxLength={80} defaultValue={state.values?.name ?? "Pelanggan simulasi"} />}
      </Field>
      <Field label="Pesan pelanggan" error={state.error}>
        {(p) => <Textarea {...p} name="body" rows={2} maxLength={4000} required defaultValue={state.values?.body} placeholder="Kak, tokonya buka jam berapa?" />}
      </Field>
      <Button type="submit" loading={pending} className="self-start">
        Kirim sebagai pelanggan
      </Button>
    </form>
  );
}

export function HandOverButton({ slug, conversationId, handledBy }: { slug: string; conversationId: string; handledBy: "agent" | "human" }) {
  const [pending, start] = useTransition();
  const call = useServerCall();
  const toast = useToast();
  const toHuman = handledBy === "agent";
  return (
    <Button
      variant={toHuman ? "primary" : "secondary"}
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const ok = await call(async () => {
            await handOver(slug, conversationId, toHuman ? "human" : "agent");
            return true;
          });
          if (ok) toast({ title: toHuman ? "Kamu yang membalas sekarang" : "Agent CS membalas lagi", tone: "success" });
        })
      }
    >
      {toHuman ? "Ambil alih" : "Serahkan ke agent"}
    </Button>
  );
}

function useResetOnOk(ok: number | undefined) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (ok) ref.current?.reset();
  }, [ok]);
  return ref;
}

export function ReplyForm({ slug, conversationId }: { slug: string; conversationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reply.bind(null, slug, conversationId), {});
  const ref = useResetOnOk(state.ok);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <Field label="Balas sebagai kamu" error={state.error} hint="Mengirim balasan sendiri otomatis mengambil alih percakapan dari agent.">
        {(p) => <Textarea {...p} name="body" rows={2} maxLength={4000} required defaultValue={state.values?.body} />}
      </Field>
      <Button type="submit" loading={pending} className="self-end">
        Kirim
      </Button>
    </form>
  );
}

export function ThreadSimulator({ slug, customerName }: { slug: string; customerName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(simulateInThread.bind(null, slug, customerName), {});
  const ref = useResetOnOk(state.ok);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <Field label={`Pesan baru dari ${customerName} (simulasi)`} error={state.error}>
        {(p) => <Input {...p} name="body" maxLength={4000} required defaultValue={state.values?.body} />}
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="self-end">
        Kirim sebagai pelanggan
      </Button>
    </form>
  );
}

type Item = { key: number; title: string; body: string };

export function BusinessInfoForm({ slug, initial }: { slug: string; initial: { title: string; body: string }[] }) {
  const [state, action, pending] = useActionState(saveInfo.bind(null, slug), {} as FormState & { items?: { title: string; body: string }[] });
  const seed = initial.length ? initial : [{ title: "", body: "" }];
  const [items, setItems] = useState<Item[]>(seed.map((it, i) => ({ key: i, ...it })));
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast({ title: "Info bisnis tersimpan", tone: "success" });
  }, [state.ok, toast]);
  // React me-reset form setelah action: isi ulang dari nilai yang dikirim supaya isian tidak hilang.
  const [lastItems, setLastItems] = useState(state.items);
  const [gen, setGen] = useState(0);
  if (state.items !== lastItems) {
    setLastItems(state.items);
    if (state.items) {
      const g = gen + 1;
      setGen(g);
      setItems((state.items.length ? state.items : [{ title: "", body: "" }]).map((it, i) => ({ key: g * 1000 + i, ...it })));
    }
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {items.map((it, i) => (
        <fieldset key={it.key} className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-text">Bagian {i + 1}</legend>
          <Field label="Judul">
            {(p) => <Input {...p} name="title" maxLength={120} defaultValue={it.title} placeholder="Mis. Jam buka, Ongkir, Cara order" />}
          </Field>
          <Field label="Isi">
            {(p) => <Textarea {...p} name="body" rows={4} defaultValue={it.body} placeholder="Tulis fakta yang boleh dijawab agent, mis. Toko buka setiap hari 09.00-21.00." />}
          </Field>
          {items.length > 1 && (
            <Button type="button" variant="danger-ghost" size="sm" className="self-start" onClick={() => setItems(items.filter((x) => x.key !== it.key))}>
              <Trash2 aria-hidden />
              Hapus bagian {i + 1}
            </Button>
          )}
        </fieldset>
      ))}
      {state.error && <p className="text-sm font-medium text-danger">{state.error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {items.length < 30 ? (
          <Button type="button" variant="secondary" onClick={() => setItems([...items, { key: Date.now(), title: "", body: "" }])}>
            <Plus aria-hidden />
            Tambah bagian
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" loading={pending}>
          Simpan info bisnis
        </Button>
      </div>
    </form>
  );
}
