"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { BusinessInfoInput, saveBusinessInfo, sendHumanReply, setCsAgent, setHandledBy, simulateInbound, simulationConnection } from "@/server/cs";

export type FormState = { error?: string; ok?: number; values?: Record<string, string> };

/** Agent yang membalas di satu koneksi. connectionId "simulasi" = koneksi simulasi kantor (dibuat bila belum ada). */
export async function chooseAgent(slug: string, connectionId: string, agentId: string) {
  const { office } = await requireMember(slug);
  const id = connectionId === "simulasi" ? await simulationConnection(office.id) : connectionId;
  const r = await setCsAgent(office.id, id, agentId || null);
  revalidatePath(`/o/${slug}/cs`);
  return r;
}

export async function simulate(slug: string, _: FormState, form: FormData): Promise<FormState> {
  const { office } = await requireMember(slug);
  const values = { name: String(form.get("name") ?? ""), body: String(form.get("body") ?? "") };
  const r = await simulateInbound(office.id, values.name, values.body);
  if ("error" in r) return { error: r.error, values };
  revalidatePath(`/o/${slug}/cs`);
  redirect(`/o/${slug}/cs/${r.conversationId}`);
}

/** Pesan pelanggan simulasi dari dalam percakapan (nama pelanggan tetap). */
export async function simulateInThread(slug: string, customerName: string, _: FormState, form: FormData): Promise<FormState> {
  const { office } = await requireMember(slug);
  const body = String(form.get("body") ?? "");
  const r = await simulateInbound(office.id, customerName, body);
  if ("error" in r) return { error: r.error, values: { body } };
  revalidatePath(`/o/${slug}/cs/${r.conversationId}`);
  return { ok: Date.now() };
}

export async function handOver(slug: string, conversationId: string, who: "agent" | "human") {
  const { office } = await requireMember(slug);
  await setHandledBy(office.id, conversationId, who);
  revalidatePath(`/o/${slug}/cs/${conversationId}`);
}

export async function reply(slug: string, conversationId: string, _: FormState, form: FormData): Promise<FormState> {
  const { office } = await requireMember(slug);
  const body = String(form.get("body") ?? "");
  const r = await sendHumanReply(office.id, conversationId, body);
  revalidatePath(`/o/${slug}/cs/${conversationId}`);
  if ("error" in r) return { error: r.error, values: { body } };
  return { ok: Date.now() };
}

export async function saveInfo(slug: string, _: FormState, form: FormData): Promise<FormState & { items?: { title: string; body: string }[] }> {
  const { office } = await requireMember(slug);
  const titles = form.getAll("title").map(String);
  const bodies = form.getAll("body").map(String);
  const items = titles.map((t, i) => ({ title: t, body: bodies[i] ?? "" })).filter((it) => it.title.trim() || it.body.trim());
  const parsed = BusinessInfoInput.safeParse(items);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid.", items };
  await saveBusinessInfo(office.id, parsed.data);
  revalidatePath(`/o/${slug}/cs/info`);
  return { ok: Date.now(), items: parsed.data };
}
