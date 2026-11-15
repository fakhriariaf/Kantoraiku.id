import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMember } from "@/server/auth";
import { listDevices } from "@/server/office";
import { officeSettings } from "@/server/settings";
import { SettingsShell } from "../settings-shell";
import { VideoChargingToggle } from "../forms";

type P = { params: Promise<{ slug: string }> };

export default function VideoSettingsPage({ params }: P) {
  return (
    <SettingsShell title="Video" description="Kapan dan di PC mana video dibuat.">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <VideoSettings params={params} />
      </Suspense>
    </SettingsShell>
  );
}

async function VideoSettings({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const [s, devices] = await Promise.all([officeSettings(office.id), listDevices(office.id)]);
  const pcs = devices.filter((d) => d.kind.startsWith("pc_"));

  return (
    <div className="flex flex-col gap-6">
      <VideoChargingToggle slug={slug} on={s?.video_only_charging ?? false} />

      <section aria-labelledby="pc-video" className="flex flex-col gap-2 border-t border-border pt-5">
        <h3 id="pc-video" className="text-sm font-semibold text-text">
          PC yang membuat video
        </h3>
        {pcs.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada PC tersambung.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {pcs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-text">{d.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {d.status === "online" && d.on_battery && <StatusPill tone="waiting">Memakai baterai</StatusPill>}
                  <StatusPill tone={d.capabilities.includes("video") ? "online" : "offline"}>
                    {d.capabilities.includes("video") ? "Membuat video" : "Tidak membuat video"}
                  </StatusPill>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-text-muted">
          Ubah di{" "}
          <Link href={`/o/${slug}/perangkat`} className="font-semibold text-accent underline underline-offset-2">
            Pengaturan › PC dan perangkat
          </Link>
          . Sumber visual dan gaya gambar diatur per channel.
        </p>
      </section>
    </div>
  );
}
