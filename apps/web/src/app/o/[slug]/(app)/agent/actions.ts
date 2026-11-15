"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { AgentInput, archiveAgent, createAgent, updateAgent } from "@/server/office";
import { setAgentSkills } from "@/server/skills";

export type AgentFormState = {
  errors?: Partial<Record<"name" | "title" | "job_description" | "brain" | "model" | "appearance" | "form", string>>;
  /** Nilai yang dikirim, supaya isian tidak hilang saat React me-reset form setelah error. */
  values?: Record<string, string>;
  skillIds?: string[];
};

export async function saveAgent(slug: string, agentId: string | null, _: AgentFormState, form: FormData): Promise<AgentFormState> {
  const { office } = await requireMember(slug);
  const values = {
    name: String(form.get("name") ?? ""),
    title: String(form.get("title") ?? ""),
    job_description: String(form.get("job_description") ?? ""),
    brain: String(form.get("brain") ?? ""),
    model: String(form.get("model") ?? ""),
    appearance: String(form.get("appearance") ?? ""),
  };
  const skillIds = form.getAll("skills").map(String);
  const parsed = AgentInput.safeParse(values);
  if (!parsed.success) {
    const errors: AgentFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
    return { errors, values, skillIds };
  }
  const r = agentId ? await updateAgent(office.id, agentId, parsed.data) : await createAgent(office.id, parsed.data);
  if ("error" in r && r.error) return { errors: { name: r.error }, values, skillIds };
  if ("id" in r && r.id) await setAgentSkills(office.id, r.id, skillIds);
  revalidatePath(`/o/${slug}/agent`);
  redirect(`/o/${slug}/agent${agentId ? "" : `?baru=${"id" in r ? r.id : ""}`}`);
}

export async function archive(slug: string, agentId: string) {
  const { office } = await requireMember(slug);
  await archiveAgent(office.id, agentId);
  revalidatePath(`/o/${slug}/agent`);
}
