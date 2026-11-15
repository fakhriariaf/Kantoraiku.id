"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { confirmProposal, sendCommand, sendText, skipProposal } from "@/server/assistant";
import { isUuid } from "@/server/skills";
import { COMMANDS, type Command } from "@/lib/assistant";

export type SendState = { error?: string; ok?: number; value?: string };

export async function send(slug: string, _: SendState, form: FormData): Promise<SendState> {
  const { office, user } = await requireMember(slug);
  const text = String(form.get("pesan") ?? "").trim();
  if (!text) return { error: "Tulis pesan dulu." };
  if (text.length > 1000) return { error: "Pesan maksimal 1.000 karakter.", value: text };
  await sendText(office.id, user.id, text);
  revalidatePath(`/o/${slug}/asisten`);
  return { ok: Date.now() };
}

export async function command(slug: string, cmd: string, label: string) {
  const { office, user } = await requireMember(slug);
  if (!(COMMANDS as readonly string[]).includes(cmd)) return;
  await sendCommand(office.id, user.id, cmd as Command, String(label).slice(0, 40));
  revalidatePath(`/o/${slug}/asisten`);
}

export async function confirm(slug: string, messageId: string) {
  const { office, user } = await requireMember(slug);
  if (!isUuid(messageId)) return;
  await confirmProposal(office.id, user.id, messageId);
  revalidatePath(`/o/${slug}/asisten`);
}

export async function skip(slug: string, messageId: string) {
  const { office, user } = await requireMember(slug);
  if (!isUuid(messageId)) return;
  await skipProposal(office.id, user.id, messageId);
  revalidatePath(`/o/${slug}/asisten`);
}
