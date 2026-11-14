import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { PublicHeader } from "@/components/shell/public-header";
import { getUser } from "@/server/auth";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Atur password · Kantoraiku", robots: { index: false } };

export default function SetPasswordPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">Atur password</h1>
          <p className="text-sm text-text-2">Password ini dipakai untuk masuk ke kantor kamu dari PC maupun HP.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <Content />
        </Suspense>
      </main>
    </>
  );
}

// Halaman ini dibuka setelah /auth/confirm menukar link email/pesanan jadi sesi.
async function Content() {
  await connection();
  const user = await getUser();
  if (!user) {
    return (
      <Banner tone="danger" title="Link sudah dipakai atau kedaluwarsa">
        Buka lagi halaman pesanan, atau minta link baru di <Link href="/lupa-password" className="font-semibold underline">Lupa password</Link>.
      </Banner>
    );
  }
  return (
    <Card>
      <SetPasswordForm email={user.email} />
    </Card>
  );
}
