import { headers } from "next/headers";
import { Suspense } from "react";
import { Chip } from "@/components/ui/chip";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { DeviceCard } from "@/components/kantor/device";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { requireMember } from "@/server/auth";
import { SettingsShell } from "../pengaturan/settings-shell";
import { requestNow } from "@/server/time";
import { listDevices } from "@/server/office";
import { relativeTime } from "@/lib/format";
import { config, publicDomain } from "@/server/config";
import { revoke } from "./actions";
import { SetupPanel } from "./setup-panel";
import { ReplacePc, VideoToggle } from "./pc-controls";
import { db, one } from "@/server/db";

type P = { params: Promise<{ slug: string }> };

const AI = { ok: "siap", missing_key: "belum ada kunci", invalid_key: "kunci salah" } as const;
const KIND = { pc_windows: "PC Windows", pc_mac: "Mac", vps_linux: "VPS" } as const;

export default function DevicesPage({ params }: P) {
  return (
    <SettingsShell title="PC dan perangkat" description="PC (dan nanti VPS) tempat agent kamu bekerja.">
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
        <Devices params={params} />
      </Suspense>
    </SettingsShell>
  );
}

async function Devices({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const devices = await listDevices(office.id);
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const defaultServer = `https://${publicDomain()}`;
  // Alamat kantor di subdomain tetap memakai server bawaan aplikasi; selain itu (dev) harus diisi manual.
  const onPublicDomain = host === publicDomain() || host.endsWith(`.${publicDomain()}`);
  const server = onPublicDomain ? defaultServer : `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
  const now = await requestNow();
  const pcs = devices.filter((d) => d.kind.startsWith("pc_"));
  const slots = (await one<{ pc_slots: number }>(await db(), `select pc_slots from public.offices where id = $1`, [office.id]))?.pc_slots ?? 1;
  const full = pcs.length >= slots;
  const noVideo = pcs.length > 0 && !pcs.some((d) => d.capabilities.includes("video"));

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
            capabilities={[
              d.capabilities.includes("video") ? "Menjalankan agent dan membuat video" : "Menjalankan agent",
              `Konektor ${d.connector_version ?? "?"} · ${KIND[d.kind as keyof typeof KIND] ?? d.kind}`,
            ]}
            revokeAction={revoke.bind(null, slug, d.id)}
            footer={
              <div className="flex flex-col gap-3">
                {(Object.keys(d.ai_status ?? {}).length > 0 || (d.status === "online" && d.on_battery)) && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(d.ai_status ?? {}).map(([brain, st]) => (
                      <Chip key={brain} variant="outline">
                        {brain === "simulation" ? "Simulasi" : brain === "openai" ? "OpenAI" : "Claude"}: {AI[st as keyof typeof AI] ?? st}
                      </Chip>
                    ))}
                    {d.status === "online" && d.on_battery && <Chip variant="outline">Memakai baterai</Chip>}
                  </div>
                )}
                <VideoToggle slug={slug} deviceId={d.id} name={d.name} on={d.capabilities.includes("video")} />
              </div>
            }
          />
        ))}
        {pcs.length === 0 && <DeviceCard kind="pc" status="not_installed" />}
        <DeviceCard kind="vps" status="not_installed" footer={<p className="text-xs font-normal text-text-muted">Agent 24 jam lewat VPS menyusul di Fase 4.</p>} />
      </div>
      {noVideo && (
        <Banner tone="warning" title="Tidak ada PC yang membuat video">
          Tugas video menunggu di antrean sampai salah satu PC dinyalakan &quot;Pakai untuk video&quot;.
        </Banner>
      )}
      <section aria-labelledby="slot-pc" className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h3 id="slot-pc" className="text-sm font-semibold text-text">
          {pcs.length} dari {slots} slot PC terpakai
        </h3>
        <p className="text-sm text-text-2">
          {full
            ? "Semua slot terpakai. Untuk memakai PC lain, ganti salah satu PC: PC yang kamu pilih dicabut saat PC baru tersambung."
            : "Masih ada slot kosong: sambungkan PC dengan langkah di bawah."}
        </p>
        {full && <ReplacePc slug={slug} pcs={pcs.map((p) => ({ id: p.id, name: p.name }))} />}
      </section>
      {!full && <SetupPanel slug={slug} server={server} defaultServer={defaultServer} downloadUrl={config.connectorWindowsUrl} />}
    </>
  );
}
