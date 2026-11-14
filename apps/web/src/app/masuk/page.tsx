import type { Metadata } from "next";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { PublicHeader } from "@/components/shell/public-header";
import { publicDomain } from "@/server/config";
import { goToOffice, magicLinkAction } from "./actions";
import { EmailForm } from "./email-form";
import { SlugField } from "./slug-field";

export const metadata: Metadata = { title: "Masuk · Kantoraiku" };

type P = { searchParams: Promise<{ e?: string }> };

async function LinkError({ searchParams }: P) {
  const { e } = await searchParams;
  if (e !== "link") return null;
  return (
    <Banner tone="warning" title="Link sudah dipakai atau kedaluwarsa">
      Minta link baru di bawah. Setiap link hanya berlaku sekali dan selama 1 jam.
    </Banner>
  );
}

export default function MasukPage(props: P) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">Masuk ke kantor</h1>
          <p className="text-sm text-text-2">Pakai alamat kantor dan password, atau minta link masuk lewat email.</p>
        </div>
        <Suspense>
          <LinkError {...props} />
        </Suspense>
        <Card>
          <form action={goToOffice} className="flex flex-col gap-5">
            <SlugField domain={publicDomain()} />
            <Button type="submit" size="lg">Lanjut</Button>
          </form>
        </Card>
        <div className="flex items-center gap-3 text-xs font-medium text-text-muted">
          <span className="h-px flex-1 bg-border" />
          atau
          <span className="h-px flex-1 bg-border" />
        </div>
        <Card>
          <EmailForm
            action={magicLinkAction}
            submitLabel="Kirim link masuk"
            sentTitle="Cek email kamu"
            sentText="Kalau email ini terdaftar, link masuk sudah kami kirim. Link berlaku 1 jam."
          />
        </Card>
      </main>
    </>
  );
}
