import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { AgentForm } from "../agent-form";

type P = { params: Promise<{ slug: string }> };

export default function NewAgentPage({ params }: P) {
  return (
    <>
      <PageHeader title="Agent baru" description="Satu agent, satu peran. Tugas dan jadwalnya diatur sesudah ini." />
      <Card>
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <Form params={params} />
        </Suspense>
      </Card>
    </>
  );
}

async function Form({ params }: P) {
  const { slug } = await params;
  await requireMember(slug);
  return <AgentForm slug={slug} />;
}
