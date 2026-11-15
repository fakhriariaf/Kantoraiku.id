import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { requireMember } from "@/server/auth";
import { SettingsShell } from "../../pengaturan/settings-shell";
import { listBusinessInfo } from "@/server/cs";
import { BusinessInfoForm } from "../cs-ui";

type P = { params: Promise<{ slug: string }> };

export default function BusinessInfoPage({ params }: P) {
  return (
    <SettingsShell
      title="Info bisnis"
      description="Satu-satunya sumber jawaban agent CS: produk, harga, jam buka, ongkir, cara order. Yang tidak tertulis di sini diserahkan ke kamu."
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Info params={params} />
      </Suspense>
    </SettingsShell>
  );
}

async function Info({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const items = await listBusinessInfo(office.id);
  return (
    <>
      <Link href={`/o/${slug}/cs`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-2 hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        CS WhatsApp
      </Link>
      <Card>
        <BusinessInfoForm slug={slug} initial={items.map((i) => ({ title: i.title, body: i.body }))} />
      </Card>
    </>
  );
}
