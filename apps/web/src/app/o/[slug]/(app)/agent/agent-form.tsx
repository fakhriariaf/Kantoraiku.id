"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { OptionGroup } from "@/components/ui/option-group";
import { saveAgent, type AgentFormState } from "./actions";

const MODEL_HINT: Record<string, string> = {
  simulation: "Tidak dipakai: simulasi tidak memanggil AI.",
  openai: "Kosongkan untuk memakai model default konektor.",
  claude: "Kosongkan untuk memakai model default konektor.",
};
const MODEL_PLACEHOLDER: Record<string, string> = { openai: "gpt-6-astra", claude: "claude-opus-5-5" };

export function AgentForm({
  slug,
  agent,
}: {
  slug: string;
  agent?: { id: string; name: string; title: string; job_description: string; brain: string; model: string | null };
}) {
  const [state, action, pending] = useActionState<AgentFormState, FormData>(saveAgent.bind(null, slug, agent?.id ?? null), {});
  const [brain, setBrain] = useState(agent?.brain ?? "simulation");
  const e = state.errors ?? {};
  const v = state.values;

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama" hint="Panggilan agent di kantor, mis. Bayu." error={e.name}>
          {(p) => <Input {...p} name="name" defaultValue={v?.name ?? agent?.name} maxLength={40} required />}
        </Field>
        <Field label="Jabatan" hint="Mis. Periset, Penulis naskah." error={e.title}>
          {(p) => <Input {...p} name="title" defaultValue={v?.title ?? agent?.title} maxLength={60} required />}
        </Field>
      </div>
      <Field
        label="Job desk"
        hint="Tulis seperti memberi arahan ke karyawan baru: apa yang dikerjakan, gaya, batasan."
        error={e.job_description}
      >
        {(p) => <Textarea {...p} name="job_description" rows={6} defaultValue={v?.job_description ?? agent?.job_description} />}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-text">Otak AI</legend>
        <OptionGroup
          label="Otak AI"
          name="brain"
          value={brain}
          onValueChange={setBrain}
          options={[
            { value: "simulation", title: "Simulasi", description: "Tanpa AI dan tanpa biaya. Untuk mencoba alur kantor.", status: "available" },
            { value: "openai", title: "OpenAI", description: "Memakai API key OpenAI yang kamu isi di konektor PC.", status: "available" },
            { value: "claude", title: "Claude", description: "Memakai API key Anthropic yang kamu isi di konektor PC.", status: "available" },
          ]}
        />
        {e.brain && <p className="text-sm font-medium text-danger">{e.brain}</p>}
      </fieldset>

      {brain !== "simulation" && (
        <Field label="Model" optional hint={MODEL_HINT[brain]} error={e.model}>
          {(p) => <Input {...p} name="model" defaultValue={v?.model ?? agent?.model ?? ""} placeholder={MODEL_PLACEHOLDER[brain]} autoCapitalize="none" spellCheck={false} />}
        </Field>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary">
          <Link href={`/o/${slug}/agent`}>Batal</Link>
        </Button>
        <Button type="submit" loading={pending}>
          {agent ? "Simpan perubahan" : "Buat agent"}
        </Button>
      </div>
    </form>
  );
}
