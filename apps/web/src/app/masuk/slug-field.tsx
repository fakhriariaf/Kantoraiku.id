"use client";

import { Field, InputGroup } from "@/components/ui/field";

export function SlugField({ domain }: { domain: string }) {
  return (
    <Field label="Alamat kantor">
      {(p) => (
        <InputGroup {...p} name="slug" size="lg" suffix={`.${domain}`} autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="studio-kamu" />
      )}
    </Field>
  );
}
