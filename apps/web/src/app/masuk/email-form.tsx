"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import type { EmailState } from "./actions";

/** Form satu kolom email: dipakai untuk link masuk (S06) dan lupa password (S07). */
export function EmailForm({
  action,
  submitLabel,
  sentTitle,
  sentText,
}: {
  action: (s: EmailState, f: FormData) => Promise<EmailState>;
  submitLabel: string;
  sentTitle: string;
  sentText: string;
}) {
  const [state, formAction, pending] = useActionState<EmailState, FormData>(action, {});
  if (state.sent) {
    return (
      <Banner tone="success" title={sentTitle}>
        <span className="inline-flex items-start gap-1.5">
          <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {sentText}
        </span>
      </Banner>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Email" hint="Email yang kamu pakai saat membeli kantor." error={state.error}>
        {(p) => <Input {...p} name="email" type="email" size="lg" autoComplete="email" inputMode="email" required />}
      </Field>
      <Button type="submit" size="lg" variant="secondary" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
