import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { PublicHeader } from "@/components/shell/public-header";
import { getUser, listOfficesForUser } from "@/server/auth";
import { officeUrl } from "@/server/config";

export const metadata: Metadata = { title: "Kantor saya · Kantoraiku", robots: { index: false } };

export default function MyOfficesPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <h1 className="text-2xl">Kantor saya</h1>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <Offices />
        </Suspense>
      </main>
    </>
  );
}

/** Tujuan setelah link masuk / atur password: langsung ke kantor bila hanya satu. */
async function Offices() {
  await connection();
  const user = await getUser();
  if (!user) redirect("/masuk");
  const offices = await listOfficesForUser(user.id);
  if (offices.length === 1) redirect(officeUrl(offices[0].slug));
  if (offices.length === 0) {
    return (
      <Banner tone="info" title="Belum ada kantor untuk akun ini">
        Akun {user.email} belum terhubung ke kantor mana pun. <Link href="/beli" className="font-semibold underline">Buat kantor</Link>.
      </Banner>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
      {offices.map((o) => (
        <li key={o.slug}>
          <Link href={officeUrl(o.slug)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/50">
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-text">{o.display_name}</span>
              <span className="font-mono text-xs text-text-muted">{o.slug}</span>
            </span>
            <ChevronRight aria-hidden className="size-4 text-text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
