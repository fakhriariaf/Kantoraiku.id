"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, LogOut, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import {
  changePassword,
  logoutEverywhere,
  renameOffice,
  saveBudgetAction,
  saveCsAction,
  saveRevisionsAction,
  saveVideoAction,
  type BudgetFormState,
  type CsFormState,
  type FormState,
  type PasswordState,
} from "./actions";

/** Batas revisi pemilik per konten (1 sampai 10), disimpan langsung tiap kali diubah. */
export function RevisionsStepper({ slug, value: initial }: { slug: string; value: number }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  const save = (n: number) => {
    const prev = value;
    setValue(n);
    start(async () => {
      const r = await call(() => saveRevisionsAction(slug, n));
      if (!r || "error" in r) {
        setValue(prev);
        toast({ title: r && "error" in r && r.error ? r.error : "Gagal menyimpan", tone: "error" });
      }
    });
  };
  return (
    <div className="flex items-center gap-3" aria-busy={pending}>
      <div role="group" aria-label="Batas revisi" className="inline-flex items-center rounded-md border border-border-input bg-surface">
        <button
          type="button"
          aria-label="Kurangi batas revisi"
          disabled={value <= 1 || pending}
          onClick={() => save(value - 1)}
          className="inline-flex size-10 items-center justify-center text-text-2 hover:text-text disabled:opacity-40"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <output aria-live="polite" className="w-10 text-center text-base font-semibold text-text tabular-nums">
          {value}
        </output>
        <button
          type="button"
          aria-label="Tambah batas revisi"
          disabled={value >= 10 || pending}
          onClick={() => save(value + 1)}
          className="inline-flex size-10 items-center justify-center text-text-2 hover:text-text disabled:opacity-40"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      <span className="text-sm text-text-2">kali per konten</span>
    </div>
  );
}

const SAVER = [
  { value: "off" as const, label: "Mati" },
  { value: "auto" as const, label: "Otomatis" },
  { value: "on" as const, label: "Nyala" },
];

export function BudgetForm({
  slug,
  mode: initialMode,
  budgetUsd,
  threshold,
}: {
  slug: string;
  mode: "off" | "auto" | "on";
  budgetUsd: string;
  threshold: number;
}) {
  const [state, action, pending] = useActionState<BudgetFormState, FormData>(saveBudgetAction.bind(null, slug), {});
  const [mode, setMode] = useState(initialMode);
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast({ title: "Anggaran disimpan", tone: "success" });
  }, [state.ok, toast]);
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span id="mode-hemat" className="text-sm font-semibold text-text">
          Mode hemat
        </span>
        <SegmentedControl label="Mode hemat" options={SAVER} value={mode} onValueChange={setMode} />
        <input type="hidden" name="saver_mode" value={mode} />
        <p className="text-xs text-text-muted">
          {mode === "on"
            ? "Tugas berprioritas rendah dilewati sekarang juga."
            : mode === "auto"
              ? "Tugas berprioritas rendah dilewati begitu biaya bulan ini mencapai ambang di bawah."
              : "Semua tugas tetap jalan, berapa pun biayanya."}
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Anggaran AI per bulan (USD)" optional hint="Kosong = tanpa anggaran. Mode otomatis butuh anggaran." error={state.errors?.budget_usd}>
          {(p) => <Input {...p} name="budget_usd" inputMode="decimal" defaultValue={budgetUsd} placeholder="20" />}
        </Field>
        <Field label="Nyalakan mode hemat pada (%)" hint="Persen dari anggaran bulanan, 10 sampai 100." error={state.errors?.saver_threshold_pct}>
          {(p) => <Input {...p} name="saver_threshold_pct" type="number" min={10} max={100} defaultValue={threshold} required />}
        </Field>
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Simpan
      </Button>
    </form>
  );
}

export function VideoChargingToggle({ slug, on }: { slug: string; on: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const toast = useToast();
  const call = useServerCall();
  return (
    <Switch
      label="Buat video hanya saat laptop dicas"
      description="Saat laptop memakai baterai, tugas video menunggu sampai dicas lagi. Riset, naskah, dan CS tetap jalan. PC tanpa baterai tidak terpengaruh."
      checked={value}
      disabled={pending}
      onCheckedChange={(next) => {
        setValue(next);
        start(async () => {
          const r = await call(() => saveVideoAction(slug, next));
          if (!r) return setValue(!next);
          toast({ title: next ? "Video hanya dibuat saat dicas" : "Video dibuat kapan saja", tone: "success" });
        });
      }}
    />
  );
}

export function CsSettingsForm({
  slug,
  s,
}: {
  slug: string;
  s: { enabled: boolean; greeting: "kamu" | "kak"; offline_reply: string; quiet_minutes: number; stale_hours: number };
}) {
  const [state, action, pending] = useActionState<CsFormState, FormData>(saveCsAction.bind(null, slug), {});
  const [enabled, setEnabled] = useState(s.enabled);
  const [greeting, setGreeting] = useState(s.greeting);
  const [offline, setOffline] = useState(s.offline_reply);
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast({ title: "Pengaturan CS disimpan", tone: "success" });
  }, [state.ok, toast]);
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-5">
      <Switch
        label="CS aktif"
        description="Mati: chat tetap tersimpan dan tampil di daftar percakapan, tapi agent CS tidak membalas."
        checked={enabled}
        onCheckedChange={setEnabled}
      />
      {enabled && <input type="hidden" name="enabled" value="on" />}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-text">Sapaan</span>
        <SegmentedControl
          label="Sapaan ke pelanggan"
          options={[
            { value: "kamu" as const, label: "kamu" },
            { value: "kak" as const, label: "kak" },
          ]}
          value={greeting}
          onValueChange={setGreeting}
        />
        <input type="hidden" name="greeting" value={greeting} />
        <p className="text-xs text-text-muted">Cara agent CS memanggil pelanggan.</p>
      </div>
      <Field
        label="Balasan singkat saat PC mati"
        optional
        hint={`Dikirim bila tidak ada PC atau VPS yang online, paling sering sekali per pelanggan per jam. Kosong = tidak dikirim. ${offline.length}/500`}
        error={e.offline_reply}
      >
        {(p) => (
          <Textarea
            {...p}
            name="offline_reply"
            rows={3}
            maxLength={500}
            value={offline}
            onChange={(ev) => setOffline(ev.target.value)}
            placeholder="Terima kasih, pesanmu sudah kami terima. Kami balas sebentar lagi ya."
          />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="CS diam setelah kamu membalas (jam)" hint="Setelah kamu membalas sendiri, agent CS diam di chat itu selama ini. 0,5 sampai 168." error={e.quiet_hours}>
          {(p) => <Input {...p} name="quiet_hours" inputMode="decimal" defaultValue={String(s.quiet_minutes / 60).replace(".", ",")} required />}
        </Field>
        <Field label="Batas chat lama (jam)" hint="Chat yang menunggu lebih lama dari ini (mis. PC mati semalam) tidak dijawab otomatis, tapi diserahkan ke kamu." error={e.stale_hours}>
          {(p) => <Input {...p} name="stale_hours" type="number" min={1} max={168} defaultValue={s.stale_hours} required />}
        </Field>
      </div>
      <Button type="submit" loading={pending} className="self-start">
        Simpan pengaturan CS
      </Button>
    </form>
  );
}

export function OfficeNameForm({ slug, name, canEdit }: { slug: string; name: string; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(renameOffice.bind(null, slug), {});
  const toast = useToast();
  useEffect(() => {
    if (state.ok) toast({ title: "Nama kantor disimpan", tone: "success" });
  }, [state.ok, toast]);

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Field
        label="Nama kantor"
        hint={canEdit ? "Tampil di menu atas, di kantor virtual, dan di aplikasi PC." : "Hanya pemilik kantor yang bisa menggantinya."}
        error={state.error}
        className="min-w-0 flex-1"
      >
        {(p) => <Input {...p} name="nama" defaultValue={name} maxLength={80} required readOnly={!canEdit} />}
      </Field>
      {canEdit && (
        <Button type="submit" variant="secondary" loading={pending} className="sm:mt-7">
          Simpan
        </Button>
      )}
    </form>
  );
}

export function PasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword.bind(null, slug), {});
  const ref = useRef<HTMLFormElement>(null);
  const toast = useToast();
  useEffect(() => {
    if (!state.ok) return;
    ref.current?.reset();
    toast({ title: "Password diganti", description: "Pakai password baru saat masuk berikutnya.", tone: "success" });
  }, [state.ok, toast]);
  const err = (f: PasswordState["field"]) => (state.field === f ? state.error : undefined);

  return (
    <form ref={ref} action={action} className="flex max-w-md flex-col gap-4">
      <Field label="Password lama" error={err("lama")}>
        {(p) => <Input {...p} name="lama" type="password" autoComplete="current-password" required />}
      </Field>
      <Field label="Password baru" hint="Minimal 8 karakter." error={err("baru")}>
        {(p) => <Input {...p} name="baru" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />}
      </Field>
      <Field label="Ulangi password baru" error={err("ulang")}>
        {(p) => <Input {...p} name="ulang" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />}
      </Field>
      {state.error && !state.field && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        <KeyRound aria-hidden />
        Ganti password
      </Button>
    </form>
  );
}

export function LogoutEverywhereButton({ slug }: { slug: string }) {
  return (
    <form action={logoutEverywhere.bind(null, slug)}>
      <Button type="submit" variant="secondary">
        <LogOut aria-hidden />
        Keluar dari semua perangkat
      </Button>
    </form>
  );
}
