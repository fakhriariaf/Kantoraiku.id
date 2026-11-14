"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

type State = { error?: string };

/** Form email + password, dipakai di login kantor (S10) dan login admin. */
export function LoginForm({
  action,
  submitLabel,
  defaultEmail,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  submitLabel: string;
  defaultEmail?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field label="Email">
        {(p) => <Input {...p} name="email" type="email" size="lg" autoComplete="email" inputMode="email" defaultValue={defaultEmail} required />}
      </Field>
      <Field label="Password">
        {(p) => <Input {...p} name="password" type="password" size="lg" autoComplete="current-password" required />}
      </Field>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
