"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { createSetupCode, revokeDevice } from "@/server/office";

export async function newSetupCode(slug: string) {
  const { office, user } = await requireMember(slug);
  const { code, expiresAt } = await createSetupCode(office.id, user.id);
  return { code, expiresAt: new Date(expiresAt).toISOString() };
}

export async function revoke(slug: string, deviceId: string) {
  const { office } = await requireMember(slug);
  await revokeDevice(office.id, deviceId);
  revalidatePath(`/o/${slug}/perangkat`);
}
