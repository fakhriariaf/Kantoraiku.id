"use server";

import { redirect } from "next/navigation";
import { createManualOrder, OrderInput, slugStatus } from "@/server/orders";

export type OrderFormState = {
  errors?: Partial<Record<"name" | "email" | "whatsapp" | "slug" | "form", string>>;
  values?: Record<string, string>;
};

export async function checkSlug(slug: string) {
  return slugStatus(slug);
}

export async function createOrderAction(_: OrderFormState, form: FormData): Promise<OrderFormState> {
  const values = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    whatsapp: String(form.get("whatsapp") ?? ""),
    slug: String(form.get("slug") ?? ""),
  };
  const parsed = OrderInput.safeParse(values);
  if (!parsed.success) {
    const errors: OrderFormState["errors"] = {};
    for (const i of parsed.error.issues) errors[i.path[0] as "name"] ??= i.message;
    return { errors, values };
  }
  const r = await createManualOrder(parsed.data);
  if ("slugError" in r) return { errors: { slug: r.slugError }, values };
  redirect(`/pesanan/${r.token}`);
}
