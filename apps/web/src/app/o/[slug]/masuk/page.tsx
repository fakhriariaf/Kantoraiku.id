import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { Logo } from "@/components/shell/public-header";
import { LoginForm } from "@/components/shell/login-form";
import { db, one } from "@/server/db";
import { config } from "@/server/config";
import { officeLogin } from "../actions";

export const metadata: Metadata = { title: "Masuk · Kantoraiku", robots: { index: false } };

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ e?: string }> };

export default function OfficeLoginPage(props: P) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-(--k-gutter) py-12">
      <Logo />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Content {...props} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }: P) {
  await connection();
  const [{ slug }, { e }] = await Promise.all([params, searchParams]);
  const office = await one<{ display_name: string }>(
    await db(),
    `select display_name from public.offices where slug = $1 and status <> 'closed'`,
    [slug],
  );
  if (!office) notFound();
  const help = `https://wa.me/${config.adminWhatsapp}?text=${encodeURIComponent(`Halo, saya butuh bantuan masuk ke kantor ${slug}.`)}`;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">Masuk ke {office.display_name}</h1>
        <p className="font-mono text-xs text-text-muted">{slug}</p>
      </div>
      {e === "bukan-anggota" && (
        <Banner tone="warning" title="Akun kamu bukan anggota kantor ini">
          Masuk dengan email yang dipakai saat membeli kantor ini.
        </Banner>
      )}
      <Card>
        <LoginForm action={officeLogin.bind(null, slug)} submitLabel="Masuk" />
      </Card>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/lupa-password" className="self-start font-semibold text-accent underline-offset-4 hover:underline">
          Lupa password?
        </Link>
        <a href={help} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start font-semibold text-text-2 hover:text-text">
          <MessageCircle aria-hidden className="size-4" />
          Butuh bantuan? Hubungi kami
        </a>
      </div>
    </>
  );
}
