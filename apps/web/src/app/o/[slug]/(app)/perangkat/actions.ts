"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { createSetupCode, revokeDevice } from "@/server/office";
import { createReplaceCode, setDeviceVideo } from "@/server/settings";

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

export async function setVideoAction(slug: string, deviceId: string, on: boolean) {
  const { office } = await requireMember(slug);
  const r = await setDeviceVideo(office.id, deviceId, on);
  revalidatePath(`/o/${slug}/perangkat`);
  return r;
}

export async function replaceCodeAction(slug: string, deviceId: string) {
  const { office, user } = await requireMember(slug);
  return createReplaceCode(office.id, user.id, deviceId);
}
