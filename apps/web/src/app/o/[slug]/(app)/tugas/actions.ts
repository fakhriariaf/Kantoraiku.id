"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { createTask, deleteTask, runTaskNow, setTaskEnabled, TaskInput } from "@/server/office";

export type TaskFormState = {
  errors?: Partial<Record<"name" | "agent_id" | "channel_id" | "after_task_id" | "time" | "days" | "form", string>>;
  ok?: number;
  /** Nilai yang dikirim, supaya isian tidak hilang saat React me-reset form setelah error. */
  values?: Record<string, string>;
};

export async function addTask(slug: string, prev: TaskFormState, form: FormData): Promise<TaskFormState> {
  const { office } = await requireMember(slug);
  const values: Record<string, string> = {};
  for (const k of ["name", "agent_id", "channel_id", "kind", "instructions", "after_task_id", "time", "priority"]) values[k] = String(form.get(k) ?? "");
  const parsed = TaskInput.safeParse({
    name: form.get("name"),
    agent_id: form.get("agent_id"),
    channel_id: form.get("channel_id") ?? "",
    kind: form.get("kind"),
    instructions: form.get("instructions") ?? "",
    trigger: form.get("trigger"),
    after_task_id: form.get("after_task_id") ?? "",
    time: form.get("time") ?? "",
    days: form.getAll("days"),
    priority: form.get("priority") ?? 1,
  });
  if (!parsed.success) {
    const errors: TaskFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[(i.path[0] as "name") ?? "form"] ??= i.message;
    return { errors, values, ok: prev.ok };
  }
  const r = await createTask(office.id, parsed.data);
  if ("error" in r && r.error) return { errors: { form: r.error }, values, ok: prev.ok };
  revalidatePath(`/o/${slug}/tugas`);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function runNow(slug: string, taskId: string) {
  const { office } = await requireMember(slug);
  const id = await runTaskNow(office.id, taskId);
  revalidatePath(`/o/${slug}/tugas`);
  return { ok: !!id };
}

export async function toggleTask(slug: string, taskId: string, enabled: boolean) {
  const { office } = await requireMember(slug);
  await setTaskEnabled(office.id, taskId, enabled);
  revalidatePath(`/o/${slug}/tugas`);
}

export async function removeTask(slug: string, taskId: string) {
  const { office } = await requireMember(slug);
  await deleteTask(office.id, taskId);
  revalidatePath(`/o/${slug}/tugas`);
}
