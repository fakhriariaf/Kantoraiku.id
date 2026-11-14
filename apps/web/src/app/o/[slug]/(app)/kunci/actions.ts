"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { removeKey, saveKey } from "@/server/secrets";

/** Menerima kunci yang SUDAH dienkripsi di browser. Kunci aslinya tidak pernah sampai ke server. */
export async function saveKeyAction(slug: string, deviceId: string, kind: string, ciphertext: string, hint: string) {
  const { office } = await requireMember(slug);
  const r = await saveKey(office.id, deviceId, kind, ciphertext, hint);
  revalidatePath(`/o/${slug}/kunci`);
  return r;
}

export async function removeKeyAction(slug: string, deviceId: string, kind: string) {
  const { office } = await requireMember(slug);
  await removeKey(office.id, deviceId, kind);
  revalidatePath(`/o/${slug}/kunci`);
}
