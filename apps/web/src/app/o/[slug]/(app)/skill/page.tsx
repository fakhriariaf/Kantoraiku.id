import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { listSkills } from "@/server/skills";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ baru?: string; disimpan?: string; dihapus?: string }> };

export default function SkillsPage(props: P) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      }
    >
      <Skills {...props} />
    </Suspense>
  );
}

function firstLine(md: string) {
  return md.split("\n").map((l) => l.replace(/^[#>*\-\s]+/, "").trim()).find(Boolean) ?? "";
}

async function Skills({ params, searchParams }: P) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const skills = await listSkills(office.id);
  const changed = skills.find((s) => s.id === (q.baru ?? q.disimpan));

  return (
    <>
      <PageHeader
        title="Skill"
        description="Instruksi yang bisa dipasang ke beberapa agent sekaligus, mis. cara membuka video atau gaya bahasa channel."
        actions={
          <Button asChild>
            <Link href={`/o/${slug}/skill/baru`}>
              <Plus aria-hidden />
              Skill baru
            </Link>
          </Button>
        }
      />
      {changed && q.baru && (
        <Banner
          tone="success"
          title={`Skill "${changed.name}" dibuat`}
          action={<Button asChild size="sm" variant="secondary"><Link href={`/o/${slug}/agent`}>Pasang ke agent</Link></Button>}
        >
          Buka agent yang perlu skill ini, lalu centang di bagian Skill.
        </Banner>
      )}
      {changed && q.disimpan && <Banner tone="success" title={`Perubahan "${changed.name}" tersimpan`}>Agent memakai versi baru mulai tugas berikutnya.</Banner>}
      {q.dihapus && <Banner tone="info" title="Skill dihapus">Skill sudah dilepas dari semua agent.</Banner>}

      {skills.length === 0 ? (
        <Card variant="flat">
          <EmptyState
            icon={<Sparkles aria-hidden />}
            title="Belum ada skill"
            description="Tulis sekali, pakai di banyak agent. Misalnya aturan membuat hook 3 detik untuk semua penulis naskah."
            action={<Button asChild><Link href={`/o/${slug}/skill/baru`}>Buat skill pertama</Link></Button>}
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {skills.map((s) => (
            <li key={s.id}>
              <Link
                href={`/o/${slug}/skill/${s.id}`}
                className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong md:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 break-words text-lg">{s.name}</h2>
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-text-muted group-hover:text-text" />
                </div>
                <p className="line-clamp-2 text-sm text-text-2">{s.description || firstLine(s.body_md)}</p>
                <div className="mt-auto">
                  <Chip variant="outline">{s.agents === 0 ? "Belum dipasang" : `Dipakai ${s.agents} agent`}</Chip>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
