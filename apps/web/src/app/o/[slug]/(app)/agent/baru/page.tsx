import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listSkills } from "@/server/skills";
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
  const { office } = await requireMember(slug);
  const skills = await listSkills(office.id);
  return <AgentForm slug={slug} skills={skills} />;
}
