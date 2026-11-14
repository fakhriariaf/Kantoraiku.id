"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { ChannelInput, createChannel, setChannelMode } from "@/server/office";

export type ChannelFormState = { errors?: Partial<Record<"name" | "niche" | "form", string>>; ok?: number; values?: Record<string, string> };

export async function addChannel(slug: string, prev: ChannelFormState, form: FormData): Promise<ChannelFormState> {
  const { office } = await requireMember(slug);
  const values = {
    name: String(form.get("name") ?? ""),
    niche: String(form.get("niche") ?? ""),
    content_language: String(form.get("content_language") ?? "id"),
    mode: String(form.get("mode") ?? "manual"),
  };
  const parsed = ChannelInput.safeParse(values);
  if (!parsed.success) {
    const errors: ChannelFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
    return { errors, values, ok: prev.ok };
  }
  await createChannel(office.id, parsed.data);
  revalidatePath(`/o/${slug}/channel`);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function changeMode(slug: string, channelId: string, mode: "manual" | "auto") {
  const { office } = await requireMember(slug);
  await setChannelMode(office.id, channelId, mode);
  revalidatePath(`/o/${slug}/channel`);
}
