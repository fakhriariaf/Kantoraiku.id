import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listAssistantMessages } from "@/server/assistant";
import { timeOnly } from "@/lib/format";
import { AssistantChat } from "./assistant-ui";

type P = { params: Promise<{ slug: string }> };

export default function AssistantPage({ params }: P) {
  return (
    <>
      <PageHeader title="Asisten" description="Siapkan kantor lewat chat: PC, channel, agent, skill, dan tugas. Kamu yang memutuskan setiap langkah." />
      <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
        <Chat params={params} />
      </Suspense>
    </>
  );
}

async function Chat({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const tz = office.timezone || "Asia/Jakarta";
  const messages = (await listAssistantMessages(office.id)).map((m) => ({
    ...m,
    created_at: new Date(m.created_at).toISOString(),
    time: timeOnly(m.created_at, tz),
  }));
  return <AssistantChat slug={slug} messages={messages} />;
}
