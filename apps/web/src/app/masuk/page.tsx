import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "@/components/shell/public-header";
import { SLUG_RE } from "@/server/orders";
import { publicDomain } from "@/server/config";
import { SlugField } from "./slug-field";

export const metadata: Metadata = { title: "Masuk · Kantoraiku" };

async function go(form: FormData) {
  "use server";
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  redirect(SLUG_RE.test(slug) ? `/o/${slug}/masuk` : "/masuk");
}

// Versi slice: masuk lewat alamat kantor. "Kirim link kantor ke email" menyusul bersama email (Resend).
export default function MasukPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">Masuk ke kantor</h1>
          <p className="text-sm text-text-2">Tulis alamat kantor yang kamu pilih saat membeli.</p>
        </div>
        <Card>
          <form action={go} className="flex flex-col gap-5">
            <SlugField domain={publicDomain()} />
            <Button type="submit" size="lg">Lanjut</Button>
          </form>
        </Card>
      </main>
    </>
  );
}
