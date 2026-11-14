"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { AgentInput, archiveAgent, createAgent, updateAgent } from "@/server/office";

export type AgentFormState = {
  errors?: Partial<Record<"name" | "title" | "job_description" | "brain" | "model" | "form", string>>;
};

export async function saveAgent(slug: string, agentId: string | null, _: AgentFormState, form: FormData): Promise<AgentFormState> {
  const { office } = await requireMember(slug);
  const parsed = AgentInput.safeParse({
    name: form.get("name"),
    title: form.get("title"),
    job_description: form.get("job_description") ?? "",
    brain: form.get("brain"),
    model: form.get("model") ?? "",
  });
  if (!parsed.success) {
    const errors: AgentFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
    return { errors };
  }
  const r = agentId ? await updateAgent(office.id, agentId, parsed.data) : await createAgent(office.id, parsed.data);
  if ("error" in r && r.error) return { errors: { name: r.error } };
  revalidatePath(`/o/${slug}/agent`);
  redirect(`/o/${slug}/agent${agentId ? "" : `?baru=${"id" in r ? r.id : ""}`}`);
}

export async function archive(slug: string, agentId: string) {
  const { office } = await requireMember(slug);
  await archiveAgent(office.id, agentId);
  revalidatePath(`/o/${slug}/agent`);
}
