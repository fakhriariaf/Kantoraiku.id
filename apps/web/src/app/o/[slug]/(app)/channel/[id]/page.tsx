import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { getChannel, listChannels } from "@/server/office";
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
  const [channel, all] = await Promise.all([getChannel(office.id, id), listChannels(office.id)]);
  if (!channel) notFound();
  const groups = [...new Set(all.map((c) => c.group_name).filter(Boolean))];
  return (
    <>
      <PageHeader title={channel.name} description="Ubah identitas channel, grup, dan jam posting." />
      <Card>
        <EditChannelForm slug={slug} channel={channel} groups={groups} />
      </Card>
    </>
  );
}
