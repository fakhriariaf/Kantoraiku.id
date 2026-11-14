"use client";

import { useActionState, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useServerCall } from "@/lib/use-server-call";
import { removeSkill, saveSkill, type SkillFormState } from "./actions";

const EXAMPLE = `Tiga detik pertama menentukan penonton bertahan atau tidak.

- Buka dengan pertanyaan atau fakta yang bikin penasaran, bukan salam.
- Satu kalimat, maksimal 12 kata.
- Jangan membocorkan jawabannya di pembuka.`;

export function SkillForm({
  slug,
  skill,
}: {
  slug: string;
  skill?: { id: string; name: string; description: string; body_md: string };
}) {
  const [state, action, pending] = useActionState<SkillFormState, FormData>(saveSkill.bind(null, slug, skill?.id ?? null), {});
  const e = state.errors ?? {};
  const v = state.values;

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Nama skill" hint="Mis. Hook 3 detik, Gaya bahasa santai." error={e.name}>
        {(p) => <Input {...p} name="name" defaultValue={v?.name ?? skill?.name} maxLength={80} required />}
      </Field>
      <Field label="Deskripsi singkat" optional hint="Kapan skill ini dipakai. Tampil di daftar skill." error={e.description}>
        {(p) => <Input {...p} name="description" defaultValue={v?.description ?? skill?.description} maxLength={500} />}
      </Field>
      <Field
        label="Instruksi"
        hint="Ditulis seperti arahan ke karyawan. Agent membaca ini bersama job desk-nya setiap kali bekerja. Markdown boleh."
        error={e.body_md}
      >
        {(p) => (
          <Textarea
            {...p}
            name="body_md"
            rows={12}
            defaultValue={v?.body_md ?? skill?.body_md}
            placeholder={EXAMPLE}
            className="font-mono text-sm"
            required
          />
        )}
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {skill ? <DeleteSkill slug={slug} id={skill.id} name={skill.name} /> : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href={`/o/${slug}/skill`}>Batal</Link>
          </Button>
          <Button type="submit" loading={pending}>
            {skill ? "Simpan perubahan" : "Buat skill"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeleteSkill({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [pending, start] = useTransition();
  const call = useServerCall();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger-ghost">
          <Trash2 aria-hidden />
          Hapus skill
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Hapus "${name}"?`}
        description="Skill ini dilepas dari semua agent yang memakainya. Tindakan ini tidak bisa dibatalkan."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Batal</Button>
            </DialogClose>
            <Button variant="danger" loading={pending} onClick={() => start(() => call(() => removeSkill(slug, id)))}>
              Ya, hapus
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
