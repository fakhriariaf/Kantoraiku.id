import Link from "next/link";
import { ProgressBar } from "@/components/ui/progress";
import type { BudgetState, TodayChannel } from "@/server/settings";

const usd = (micros: number) => `$${(micros / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const linkCls = "font-semibold text-accent underline-offset-4 hover:underline";

function SummaryCard({ title, id, children, link }: { title: string; id: string; children: React.ReactNode; link: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
      <h2 id={id} className="text-base">
        {title}
      </h2>
      <div className="flex flex-1 flex-col gap-2 text-sm text-text-2">{children}</div>
      <div className="text-sm">{link}</div>
    </section>
  );
}

/** Ringkasan di atas denah: hasil hari ini, siapa sedang bekerja, dan biaya AI bulan ini. */
export function SummaryCards({
  base,
  today,
  working,
  resting,
  settings,
}: {
  base: string;
  today: TodayChannel[];
  working: { id: string; name: string; label: string }[];
  resting: number;
  settings: BudgetState | null;
}) {
  const sum = (k: "published" | "ready" | "slots_left") => today.reduce((n, c) => n + c[k], 0);
  const budget = settings?.ai_budget_cents == null ? null : settings.ai_budget_cents * 10_000;
  const spend = settings?.spend_micros ?? 0;
  const stats: [string, number][] = [
    ["video terbit", sum("published")],
    ["siap diunggah", sum("ready")],
    ["jam posting lagi", sum("slots_left")],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryCard
        title="Hari ini"
        id="hari-ini"
        link={
          <Link href={`${base}/jadwal`} className={linkCls}>
            Buka jadwal
          </Link>
        }
      >
        <dl className="grid grid-cols-3 gap-2">
          {stats.map(([label, n]) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="text-2xl font-semibold text-text tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
        {today.length > 1 && (
          <ul className="flex flex-col gap-0.5 text-xs">
            {today.map((c) => (
              <li key={c.id} className="flex justify-between gap-2">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 tabular-nums">
                  {c.published} terbit · {c.ready} siap
                </span>
              </li>
            ))}
          </ul>
        )}
        {today.length === 0 && <p className="text-xs">Belum ada channel.</p>}
      </SummaryCard>

      <SummaryCard
        title="Sedang bekerja"
        id="sedang-bekerja"
        link={
          <Link href={`${base}/tugas`} className={linkCls}>
            Riwayat tugas
          </Link>
        }
      >
        {working.length === 0 ? (
          <p>
            <span className="font-semibold text-text">Belum ada agent yang bekerja.</span>
            {resting > 0 && ` ${resting} agent sedang istirahat.`}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {working.slice(0, 3).map((w) => (
              <li key={w.id} className="line-clamp-2">
                <span className="font-semibold text-text">{w.name}</span>: {w.label}
              </li>
            ))}
            {working.length > 3 && <li className="text-xs">dan {working.length - 3} agent lain</li>}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard
        title="Biaya AI bulan ini"
        id="biaya-ai"
        link={
          <Link href={`${base}/pengaturan/hemat`} className={linkCls}>
            Atur anggaran
          </Link>
        }
      >
        <p className="text-2xl font-semibold text-text tabular-nums">
          {usd(spend)}
          {budget !== null && <span className="text-sm font-normal text-text-2"> dari {usd(budget)}</span>}
        </p>
        {budget !== null && budget > 0 && (
          <ProgressBar value={Math.min(100, Math.round((spend / budget) * 100))} label="Biaya AI dari anggaran bulan ini" variant="meter" />
        )}
        <p className="text-xs">
          {settings?.saver_active
            ? "Mode hemat aktif: tugas berprioritas rendah dilewati."
            : budget === null
              ? "Belum ada anggaran bulanan."
              : "Mode hemat belum aktif."}
        </p>
      </SummaryCard>
    </div>
  );
}
