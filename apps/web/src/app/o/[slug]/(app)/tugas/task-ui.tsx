"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { MoreHorizontal, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DayPicker, SegmentedControl } from "@/components/ui/segmented";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { addTask, removeTask, runNow, toggleTask, type TaskFormState } from "./actions";

type Opt = { id: string; name: string };

export function TaskRowActions({ slug, taskId, taskName, enabled }: { slug: string; taskId: string; taskName: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await call(() => runNow(slug, taskId));
            if (!r) return;
            toast(r.ok ? { title: `"${taskName}" masuk antrean`, description: "Agent mengerjakannya begitu PC siap.", tone: "success" } : { title: "Gagal menjalankan", tone: "error" });
          })
        }
      >
        <Play aria-hidden />
        Jalankan
      </Button>
      <Menu>
        <MenuTrigger aria-label={`Menu ${taskName}`} className="inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2">
          <MoreHorizontal aria-hidden className="size-4" />
        </MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={() => start(async () => void (await call(() => toggleTask(slug, taskId, !enabled))))}>{enabled ? "Nonaktifkan" : "Aktifkan"}</MenuItem>
          <MenuItem danger icon={<Trash2 aria-hidden />} onSelect={() => start(async () => void (await call(() => removeTask(slug, taskId))))}>
            Hapus
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

const TRIGGERS = [
  { value: "manual" as const, label: "Manual" },
  { value: "after_task" as const, label: "Setelah tugas lain" },
  { value: "schedule" as const, label: "Terjadwal" },
];

type FormProps = { slug: string; agents: Opt[]; channels: Opt[]; tasks: Opt[]; defaultAgent?: string };

export function NewTaskForm(props: FormProps) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(addTask.bind(null, props.slug), {});
  const toast = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: "Tugas dibuat", tone: "success" });
  }, [state.ok, toast]);

  if (props.agents.length === 0) return <p className="text-sm text-text-muted">Buat agent dulu sebelum membuat tugas.</p>;
  // key: setelah berhasil, isi form (termasuk pilihan pemicu dan hari) kembali ke awal.
  return <TaskFields key={state.ok ?? 0} {...props} state={state} action={action} pending={pending} />;
}

function TaskFields({
  agents,
  channels,
  tasks,
  defaultAgent,
  state,
  action,
  pending,
}: FormProps & { state: TaskFormState; action: (f: FormData) => void; pending: boolean }) {
  const [trigger, setTrigger] = useState<"manual" | "after_task" | "schedule">("manual");
  const [kind, setKind] = useState("research");
  const [days, setDays] = useState<string[]>(["1", "2", "3", "4", "5", "6", "7"]);
  const e = state.errors ?? {};
  const v = state.values;

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama tugas" hint="Mis. Riset harian, Tulis naskah." error={e.name}>
          {(p) => <Input {...p} name="name" maxLength={80} required defaultValue={v?.name} />}
        </Field>
        <Field label="Agent" error={e.agent_id}>
          {(p) => (
            <Select {...p} name="agent_id" defaultValue={v?.agent_id || defaultAgent || agents[0].id}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Jenis tugas">
          {(p) => (
            <Select {...p} name="kind" value={kind} onChange={(ev) => setKind(ev.target.value)}>
              <option value="research">Riset topik</option>
              <option value="script">Tulis naskah</option>
              <option value="video">Buat video dari naskah</option>
              <option value="general">Umum (ringkasan teks)</option>
            </Select>
          )}
        </Field>
        <Field label="Channel" optional={kind === "general"} error={e.channel_id} hint={channels.length === 0 ? "Belum ada channel. Buat di menu Channel." : undefined}>
          {(p) => (
            <Select {...p} name="channel_id" defaultValue={v?.channel_id ?? channels[0]?.id ?? ""}>
              {kind === "general" && <option value="">Tanpa channel</option>}
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
      </div>

      {kind === "video" && (
        <p className="text-sm text-text-2">
          Video dirender di PC kamu dari naskah yang sudah disetujui: narasi, footage, dan teks. Biasanya dijalankan setelah tugas naskah.
          Untuk footage dan suara asli, isi <code className="font-mono text-xs">PEXELS_API_KEY</code> dan{" "}
          <code className="font-mono text-xs">ELEVENLABS_API_KEY</code> di konektor PC.
        </p>
      )}

      <Field label="Instruksi tambahan" optional hint="Ditambahkan ke job desk agent untuk tugas ini saja.">
        {(p) => <Textarea {...p} name="instructions" rows={3} defaultValue={v?.instructions} />}
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text">Kapan dijalankan</span>
        <input type="hidden" name="trigger" value={trigger} />
        <SegmentedControl label="Kapan dijalankan" options={TRIGGERS} value={trigger} onValueChange={setTrigger} />
      </div>

      {trigger === "after_task" && (
        <Field label="Jalan setelah" error={e.after_task_id} hint={tasks.length === 0 ? "Belum ada tugas lain." : "Mis. tulis naskah setelah riset selesai."}>
          {(p) => (
            <Select {...p} name="after_task_id" defaultValue={v?.after_task_id || tasks[0]?.id || ""}>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
        </Field>
      )}

      {trigger === "schedule" && (
        <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
          <Field label="Jam" hint="Zona waktu kantor (WIB)." error={e.time}>
            {(p) => <Input {...p} name="time" type="time" defaultValue={v?.time || "06:00"} required />}
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-text">Hari</span>
            <DayPicker value={days} onValueChange={setDays} />
            {days.map((d) => <input key={d} type="hidden" name="days" value={d} />)}
            {e.days && <p className="text-sm font-medium text-danger">{e.days}</p>}
          </div>
        </div>
      )}

      <Field label="Prioritas" hint="Prioritas rendah dilewati saat mode hemat aktif.">
        {(p) => (
          <Select {...p} name="priority" defaultValue={v?.priority || "1"} className="sm:w-60">
            <option value="0">Rendah</option>
            <option value="1">Normal</option>
            <option value="2">Tinggi</option>
          </Select>
        )}
      </Field>

      {e.form && <p role="alert" className="text-sm font-medium text-danger">{e.form}</p>}
      <Button type="submit" loading={pending} className="self-start">
        Buat tugas
      </Button>
    </form>
  );
}
