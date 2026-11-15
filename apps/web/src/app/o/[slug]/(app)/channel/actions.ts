"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { redirect } from "next/navigation";
import { ChannelInput, createChannel, setChannelMode, updateChannel } from "@/server/office";

export type ChannelFormState = {
  errors?: Partial<Record<"name" | "niche" | "post_times" | "visual_style" | "group_name" | "form", string>>;
  ok?: number;
  values?: Record<string, string>;
  postTimes?: string[];
};

function readChannel(form: FormData) {
  const values = {
    name: String(form.get("name") ?? ""),
    niche: String(form.get("niche") ?? ""),
    content_language: String(form.get("content_language") ?? "id"),
    mode: String(form.get("mode") ?? "manual"),
    video_visual: String(form.get("video_visual") ?? "auto"),
    visual_style: String(form.get("visual_style") ?? ""),
    group_name: String(form.get("group_name") ?? ""),
  };
  const postTimes = form.getAll("post_times").map(String).filter(Boolean);
  const parsed = ChannelInput.safeParse({ ...values, post_times: postTimes });
  if (parsed.success) return { values, postTimes, data: parsed.data };
  const errors: ChannelFormState["errors"] = {};
  for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
  return { values, postTimes, errors };
}

export async function addChannel(slug: string, prev: ChannelFormState, form: FormData): Promise<ChannelFormState> {
  const { office } = await requireMember(slug);
  const r = readChannel(form);
  if (!r.data) return { errors: r.errors, values: r.values, postTimes: r.postTimes, ok: prev.ok };
  await createChannel(office.id, r.data);
  revalidatePath(`/o/${slug}/channel`);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function editChannel(slug: string, channelId: string, _: ChannelFormState, form: FormData): Promise<ChannelFormState> {
  const { office } = await requireMember(slug);
  const r = readChannel(form);
  if (!r.data) return { errors: r.errors, values: r.values, postTimes: r.postTimes };
  await updateChannel(office.id, channelId, r.data);
  revalidatePath(`/o/${slug}/channel`);
  redirect(`/o/${slug}/channel?disimpan=${channelId}`);
}

export async function changeMode(slug: string, channelId: string, mode: "manual" | "auto") {
  const { office } = await requireMember(slug);
  await setChannelMode(office.id, channelId, mode);
  revalidatePath(`/o/${slug}/channel`);
}
