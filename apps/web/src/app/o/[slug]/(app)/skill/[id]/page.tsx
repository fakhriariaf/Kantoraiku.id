import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { getSkill } from "@/server/skills";
import { SkillForm } from "../skill-form";

type P = { params: Promise<{ slug: string; id: string }> };

export default function EditSkillPage({ params }: P) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: P) {
  const { slug, id } = await params;
  const { office } = await requireMember(slug);
  const skill = await getSkill(office.id, id);
  if (!skill) notFound();

  return (
    <>
      <PageHeader title={skill.name} description={skill.description || "Skill kantor"} />
      <Card>
        <SkillForm slug={slug} skill={skill} />
      </Card>
      <section className="flex flex-col gap-3">
        <SectionTitle>Dipakai oleh</SectionTitle>
        {skill.agents.length === 0 ? (
          <p className="text-sm text-text-muted">
            Belum ada agent yang memakai skill ini. Pasang dari halaman{" "}
            <Link href={`/o/${slug}/agent`} className="font-semibold text-accent underline underline-offset-2">
              Agent
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {skill.agents.map((a) => (
              <li key={a.id}>
                <Link href={`/o/${slug}/agent/${a.id}`} className="flex px-4 py-3 text-sm font-semibold text-text hover:bg-surface-2">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
