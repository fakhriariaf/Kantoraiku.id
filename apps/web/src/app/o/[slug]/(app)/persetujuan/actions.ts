"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { decide } from "@/server/office";

export async function decideAction(slug: string, approvalId: string, decision: "approve" | "revise" | "reject", note?: string) {
  const { office, user } = await requireMember(slug);
  const r = await decide(office.id, user.id, approvalId, decision, note?.trim() || null);
  revalidatePath(`/o/${slug}`, "layout");
  return r;
}
