import Link from "next/link";
import { Suspense } from "react";
import { KeyRound, Monitor } from "lucide-react";
import type { SecretKind } from "@kantoraiku/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader, SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { LABEL, listKeys } from "@/server/secrets";
import { KeyRow } from "./key-row";

type P = { params: Promise<{ slug: string }> };

const GROUPS: { title: string; kinds: { kind: SecretKind; hint: string; help: string }[] }[] = [
  {
    title: "Otak AI",
    kinds: [
      { kind: "openai_api_key", hint: "sk-...", help: "Untuk agent ber-otak OpenAI. Buat di platform.openai.com > API keys." },
      { kind: "anthropic_api_key", hint: "sk-ant-...", help: "Untuk agent ber-otak Claude. Buat di console Anthropic > API keys." },
    ],
  },
  {
    title: "Video",
    kinds: [
      { kind: "elevenlabs_api_key", hint: "Kunci API ElevenLabs", help: "Suara narasi video. Tanpa kunci, video memakai suara simulasi (diam)." },
      { kind: "pexels_api_key", hint: "Kunci API Pexels", help: "Footage gratis untuk latar video. Buat di pexels.com/api." },
    ],
  },
];

export default function KeysPage({ params }: P) {
  return (
    <>
      <PageHeader
        title="Kunci & integrasi"
        description="Kunci API kamu dikunci di browser ini dengan kunci milik PC, lalu hanya PC itu yang bisa membukanya. Server Kantoraiku tidak bisa membacanya."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Keys params={params} />
      </Suspense>
    </>
  );
}

async function Keys({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const devices = await listKeys(office.id);

  if (devices.length === 0) {
    return (
      <Card variant="flat">
        <EmptyState
          icon={<Monitor aria-hidden />}
          title="Belum ada PC terpasang"
          description="Kunci disimpan khusus untuk satu PC. Pasang konektor di PC kamu dulu."
          action={
            <Button asChild variant="secondary">
              <Link href={`/o/${slug}/perangkat`}>Pasang PC</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <>
      {devices.map((d) => (
        <section key={d.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound aria-hidden className="size-5 text-text-muted" />
            <SectionTitle>{d.name}</SectionTitle>
            <StatusPill tone={d.status === "online" ? "online" : "offline"} />
          </div>
          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-col rounded-xl border border-border bg-surface">
              <h3 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-2">{g.title}</h3>
              <ul className="flex flex-col divide-y divide-border">
                {g.kinds.map((k) => {
                  const s = d.secrets.find((x) => x.kind === k.kind);
                  return (
                    <KeyRow
                      key={k.kind}
                      slug={slug}
                      deviceId={d.id}
                      devicePublicKey={d.public_key}
                      kind={k.kind}
                      label={LABEL[k.kind]}
                      hint={k.hint}
                      help={k.help}
                      saved={s ? { hint: s.hint, updatedAt: s.updated_at } : null}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
      <p className="text-sm text-text-muted">
        Kunci yang diisi di sini menggantikan kunci di file <code className="font-mono text-xs">.env</code> konektor. Bila dihapus, PC kembali
        memakai isi <code className="font-mono text-xs">.env</code>.
      </p>
    </>
  );
}
