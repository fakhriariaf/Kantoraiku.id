"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/auth";
import { markPublished } from "@/server/office";

export async function publishAction(slug: string, contentId: string, url: string) {
  const { office } = await requireMember(slug);
  const link = url.trim();
  if (link && (!/^https?:\/\/\S+$/i.test(link) || link.length > 2000)) return { error: "Link postingan harus diawali http:// atau https://." };
  const r = await markPublished(office.id, contentId, link || null);
  revalidatePath(`/o/${slug}/jadwal`);
  revalidatePath(`/o/${slug}/konten/${contentId}`);
  return r;
}
