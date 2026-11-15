"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { changePassword, logoutEverywhere, renameOffice, type FormState, type PasswordState } from "./actions";

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
