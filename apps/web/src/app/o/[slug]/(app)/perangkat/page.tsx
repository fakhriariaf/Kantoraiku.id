import { headers } from "next/headers";
import { Suspense } from "react";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/feedback";
import { DeviceCard } from "@/components/kantor/device";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { PageHeader } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { requestNow } from "@/server/time";
import { listDevices } from "@/server/office";
import { relativeTime } from "@/lib/format";
import { revoke } from "./actions";
import { SetupPanel } from "./setup-panel";

type P = { params: Promise<{ slug: string }> };

const AI = { ok: "siap", missing_key: "belum ada kunci", invalid_key: "kunci salah" } as const;
const KIND = { pc_windows: "PC Windows", pc_mac: "Mac", vps_linux: "VPS" } as const;

export default function DevicesPage({ params }: P) {
  return (
    <>
      <PageHeader title="Perangkat" description="PC (dan nanti VPS) tempat agent kamu bekerja." />
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Devices params={params} />
      </Suspense>
    </>
  );
}

async function Devices({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const devices = await listDevices(office.id);
  const h = await headers();
  const server = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const now = await requestNow();
  const pcs = devices.filter((d) => d.kind.startsWith("pc_"));

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      <div className="grid gap-4 md:grid-cols-2">
        {pcs.map((d) => (
          <DeviceCard
            key={d.id}
            kind="pc"
            name={d.name}
            status={d.status === "online" ? "online" : "offline"}
            lastSeen={d.last_seen_at ? relativeTime(d.last_seen_at, now) : undefined}
            capabilities={["Menjalankan agent", `Konektor ${d.connector_version ?? "?"} · ${KIND[d.kind as keyof typeof KIND] ?? d.kind}`]}
            revokeAction={revoke.bind(null, slug, d.id)}
            footer={
              Object.keys(d.ai_status ?? {}).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(d.ai_status).map(([brain, st]) => (
                    <Chip key={brain} variant="outline">
                      {brain === "simulation" ? "Simulasi" : brain === "openai" ? "OpenAI" : "Claude"}: {AI[st as keyof typeof AI] ?? st}
                    </Chip>
                  ))}
                </div>
              )
            }
          />
        ))}
        {pcs.length === 0 && <DeviceCard kind="pc" status="not_installed" />}
        <DeviceCard kind="vps" status="not_installed" footer={<p className="text-xs font-normal text-text-muted">Agent 24 jam lewat VPS menyusul di Fase 4.</p>} />
      </div>
      <SetupPanel slug={slug} server={server} />
    </>
  );
}
