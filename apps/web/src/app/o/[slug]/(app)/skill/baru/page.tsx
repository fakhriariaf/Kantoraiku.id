import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { SkillForm } from "../skill-form";

type P = { params: Promise<{ slug: string }> };

export default function NewSkillPage({ params }: P) {
  return (
    <>
      <PageHeader title="Skill baru" description="Setelah dibuat, pasang skill ini ke agent dari halaman Agent." />
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
  return <SkillForm slug={slug} />;
}
