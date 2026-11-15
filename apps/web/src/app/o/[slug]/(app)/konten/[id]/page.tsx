import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireMember } from "@/server/auth";
import { ContentDetail } from "../content-detail";

type P = { params: Promise<{ slug: string; id: string }> };

export default function ContentPage({ params }: P) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: P) {
  const { slug, id } = await params;
  const { office } = await requireMember(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <ContentDetail slug={slug} officeId={office.id} id={id} backHref={`/o/${slug}/konten`} />;
}
