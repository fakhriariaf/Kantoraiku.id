import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { PublicHeader } from "@/components/shell/public-header";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Atur password · Kantoraiku", robots: { index: false } };

export default function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; kantor?: string }> }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">Atur password</h1>
          <p className="text-sm text-text-2">Password ini dipakai untuk masuk ke kantor kamu dari PC maupun HP.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <Content searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ token?: string; kantor?: string }> }) {
  const { token, kantor } = await searchParams;
  if (!token) {
    return (
      <Banner tone="danger" title="Link tidak lengkap">
        Buka lagi halaman pesanan kamu, lalu tekan “Atur password dan buka kantor”.
      </Banner>
    );
  }
  return (
    <Card>
      <SetPasswordForm token={token} office={kantor ?? null} />
    </Card>
  );
}
