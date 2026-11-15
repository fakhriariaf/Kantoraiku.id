import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { requireMember } from "@/server/auth";
import { officeUrl, publicDomain } from "@/server/config";
import { SettingsShell } from "./settings-shell";
import { OfficeNameForm } from "./forms";

type P = { params: Promise<{ slug: string }> };

const TZ: Record<string, string> = {
  "Asia/Jakarta": "WIB (Asia/Jakarta)",
  "Asia/Makassar": "WITA (Asia/Makassar)",
  "Asia/Jayapura": "WIT (Asia/Jayapura)",
};

export default function OfficeSettingsPage({ params }: P) {
  return (
    <SettingsShell title="Kantor" description="Identitas kantor kamu.">
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <OfficeSettings params={params} />
      </Suspense>
    </SettingsShell>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-border pt-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
      <div className="min-w-0 text-sm text-text">{children}</div>
    </div>
  );
}

async function OfficeSettings({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const url = officeUrl(slug);
  const address = url.startsWith("http") ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : `${slug}.${publicDomain()}`;

  return (
    <div className="flex flex-col gap-5">
      <OfficeNameForm slug={slug} name={office.display_name} canEdit={office.role === "owner"} />
      <Row label="Alamat kantor" hint="Dipilih saat membeli, tidak bisa diganti.">
        <span className="font-mono break-all">{address}</span>
      </Row>
      <Row label="Zona waktu" hint="Dipakai untuk jadwal tugas dan jam posting.">
        {TZ[office.timezone] ?? office.timezone}
      </Row>
    </div>
  );
}
