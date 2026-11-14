"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { SkillInput, createSkill, deleteSkill, updateSkill } from "@/server/skills";

export type SkillFormState = {
  errors?: Partial<Record<"name" | "description" | "body_md" | "form", string>>;
  /** Nilai yang dikirim, supaya isian tidak hilang saat React me-reset form setelah error. */
  values?: Record<string, string>;
};

export async function saveSkill(slug: string, skillId: string | null, _: SkillFormState, form: FormData): Promise<SkillFormState> {
  const { office } = await requireMember(slug);
  const values = {
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? ""),
    body_md: String(form.get("body_md") ?? ""),
  };
  const parsed = SkillInput.safeParse(values);
  if (!parsed.success) {
    const errors: SkillFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
    return { errors, values };
  }
  const r = skillId ? await updateSkill(office.id, skillId, parsed.data) : await createSkill(office.id, parsed.data);
  if ("error" in r) return { errors: { name: r.error }, values };
  revalidatePath(`/o/${slug}/skill`);
  revalidatePath(`/o/${slug}/agent`);
  redirect(`/o/${slug}/skill?${skillId ? "disimpan" : "baru"}=${r.id}`);
}

export async function removeSkill(slug: string, skillId: string) {
  const { office } = await requireMember(slug);
  await deleteSkill(office.id, skillId);
  revalidatePath(`/o/${slug}/skill`);
  revalidatePath(`/o/${slug}/agent`);
  redirect(`/o/${slug}/skill?dihapus=1`);
}
