"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { setPasswordAction, type PwState } from "./actions";

export function SetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<PwState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Untuk pengelola password di browser: kaitkan password baru dengan email ini. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <p className="text-sm text-text-muted">
        Akun: <span className="text-text">{email}</span>
      </p>
      <Field label="Password baru" hint="Minimal 10 karakter." error={state.field === "password" ? state.error : undefined}>
        {(p) => <Input {...p} name="password" type="password" size="lg" autoComplete="new-password" required minLength={10} />}
      </Field>
      <Field label="Ulangi password" error={state.field === "confirm" ? state.error : undefined}>
        {(p) => <Input {...p} name="confirm" type="password" size="lg" autoComplete="new-password" required />}
      </Field>
      {state.error && !state.field && <p role="alert" className="text-sm font-medium text-danger">{state.error}</p>}
      <Button type="submit" size="lg" loading={pending}>
        Simpan dan buka kantor
      </Button>
    </form>
  );
}
