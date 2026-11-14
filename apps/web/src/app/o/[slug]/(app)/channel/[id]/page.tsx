import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { getChannel } from "@/server/office";
import { EditChannelForm } from "../channel-ui";

type P = { params: Promise<{ slug: string; id: string }> };

export default function EditChannelPage({ params }: P) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: P) {
  const { slug, id } = await params;
  const { office } = await requireMember(slug);
  const channel = await getChannel(office.id, id);
  if (!channel) notFound();
  return (
    <>
      <PageHeader title={channel.name} description="Ubah identitas channel dan jam posting." />
      <Card>
        <EditChannelForm slug={slug} channel={channel} />
      </Card>
    </>
  );
}
