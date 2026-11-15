import { Suspense } from "react";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { ProgressBar } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { requireMember } from "@/server/auth";
import { officeSettings } from "@/server/settings";
import { SettingsShell } from "../settings-shell";
import { BudgetForm } from "../forms";

type P = { params: Promise<{ slug: string }> };

const usd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BudgetPage({ params }: P) {
  return (
    <SettingsShell
      title="Anggaran & hemat"
      description="Biaya AI bulan ini dari kunci API kamu, dan mode hemat yang melewati tugas berprioritas rendah saat anggaran menipis."
    >
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Budget params={params} />
      </Suspense>
    </SettingsShell>
  );
}

async function Budget({ params }: P) {
  const { slug } = await params;
  const { office } = await requireMember(slug);
  const s = (await officeSettings(office.id))!;
  const budgetMicros = s.ai_budget_cents === null ? null : s.ai_budget_cents * 10_000;
  const pct = budgetMicros ? Math.min(100, Math.round((s.spend_micros / budgetMicros) * 100)) : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="biaya" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="biaya" className="text-sm font-semibold text-text">
            Biaya AI bulan ini
          </h3>
          <StatusPill tone={s.saver_active ? "waiting" : "online"}>{s.saver_active ? "Mode hemat aktif" : "Mode hemat tidak aktif"}</StatusPill>
        </div>
        <p className="text-2xl font-semibold text-text tabular-nums">
          {usd(s.spend_micros)}
          {budgetMicros !== null && <span className="text-base font-normal text-text-2"> dari {usd(budgetMicros)}</span>}
        </p>
        {pct !== null && <ProgressBar value={pct} label={`Biaya AI bulan ini ${pct}% dari anggaran`} variant="meter" />}
        <p className="text-xs text-text-muted">
          Dihitung dari laporan biaya otak AI di PC (Claude). Otak OpenAI dan Simulasi belum melaporkan biaya.
          {s.skipped_month > 0 && ` ${s.skipped_month} tugas dilewati mode hemat bulan ini.`}
        </p>
      </section>

      {s.saver_mode === "auto" && s.ai_budget_cents === null && (
        <Banner tone="info" title="Mode otomatis butuh anggaran">
          Tanpa anggaran, mode hemat otomatis tidak pernah menyala. Isi anggaran bulanan di bawah.
        </Banner>
      )}

      <BudgetForm
        slug={slug}
        mode={s.saver_mode}
        budgetUsd={s.ai_budget_cents === null ? "" : String(s.ai_budget_cents / 100)}
        threshold={s.saver_threshold_pct}
      />
      <p className="text-xs text-text-muted">
        Prioritas tiap tugas (rendah, normal, tinggi) diatur di menu Agent › Tugas. Hanya tugas berprioritas rendah yang dilewati.
      </p>
    </div>
  );
}
