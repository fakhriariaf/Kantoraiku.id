import Link from "next/link";
import { Suspense } from "react";
import { History, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { LinkTabs } from "@/components/shell/link-tabs";
import { requireMember } from "@/server/auth";
import { requestNow } from "@/server/time";
import { CONTENT_TABS, listContentItems, type ContentItem, type ContentTab } from "@/server/content-list";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ContentDetail } from "./content-detail";
import { RunDetailView } from "./run-detail";
import { STAGE } from "./stage";

type Q = { tab?: string; kanal?: string; q?: string; pilih?: string };
type P = { params: Promise<{ slug: string }>; searchParams: Promise<Q> };

const TABS: Record<ContentTab, { label: string; empty: string; emptyText: string }> = {
  keputusan: {
    label: "Perlu keputusan",
    empty: "Tidak ada yang menunggu kamu",
    emptyText: "Naskah dan video yang perlu kamu setujui, revisi, atau tolak akan muncul di sini.",
  },
  gagal: {
    label: "Gagal",
    empty: "Tidak ada yang gagal",
    emptyText: "Konten yang gagal dibuat dan tugas agent yang gagal (7 hari terakhir) muncul di sini beserta alasannya.",
  },
  dikerjakan: {
    label: "Sedang dikerjakan",
    empty: "Agent sedang tidak mengerjakan konten",
    emptyText: "Naskah yang sedang ditulis dan video yang sedang dibuat muncul di sini.",
  },
  siap: {
    label: "Siap & terjadwal",
    empty: "Belum ada video yang siap diposting",
    emptyText: "Video yang sudah kamu setujui menunggu jam posting di sini.",
  },
  terbit: { label: "Terbit", empty: "Belum ada yang terbit", emptyText: "Video yang sudah diposting tercatat di sini." },
  laporan: {
    label: "Laporan",
    empty: "Belum ada laporan",
    emptyText: "Hasil tugas umum agent (mis. ringkasan berita atau rekap) tersimpan di sini.",
  },
  ditolak: { label: "Ditolak", empty: "Tidak ada yang ditolak", emptyText: "Naskah atau video yang kamu tolak disimpan di sini." },
};

const isTab = (t: string | undefined): t is ContentTab => !!t && (CONTENT_TABS as readonly string[]).includes(t);

export default function ContentListPage(props: P) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full rounded-xl" />}>
      <ContentList {...props} />
    </Suspense>
  );
}

function pill(i: ContentItem): { tone: StatusTone; label: string } {
  if (i.kind === "run") return i.tab === "gagal" ? { tone: "error", label: "Tugas gagal" } : { tone: "info", label: "Laporan" };
  if (i.tab === "gagal" && i.stage === "script_approved") return { tone: "error", label: "Video gagal dibuat" };
  return STAGE[i.stage] ?? { tone: "ready", label: i.stage };
}

async function ContentList({ params, searchParams }: P) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { office } = await requireMember(slug);
  const [all, now] = await Promise.all([listContentItems(office.id), requestNow()]);

  const tab: ContentTab = isTab(sp.tab) ? sp.tab : "keputusan";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const needle = q.toLowerCase();
  const channels = [...new Map(all.filter((i) => i.channel_id).map((i) => [i.channel_id!, i.channel_name ?? ""])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const kanal = channels.some(([id]) => id === sp.kanal) ? sp.kanal! : null;

  const bySearch = (i: ContentItem) => !needle || i.title.toLowerCase().includes(needle);
  const byChannel = (i: ContentItem) => !kanal || i.channel_id === kanal;
  const items = all.filter((i) => i.tab === tab && byChannel(i) && bySearch(i));
  const waiting = all.filter((i) => i.tab === "keputusan").length;
  const selected = sp.pilih ? all.find((i) => i.id === sp.pilih) ?? null : null;

  const base = `/o/${slug}/konten`;
  const href = (o: Partial<{ tab: ContentTab; kanal: string | null; q: string; pilih: string | null }>) => {
    const u = new URLSearchParams();
    const t = o.tab ?? tab;
    if (t !== "keputusan") u.set("tab", t);
    const k = o.kanal === undefined ? kanal : o.kanal;
    if (k) u.set("kanal", k);
    const s = o.q ?? q;
    if (s) u.set("q", s);
    if (o.pilih) u.set("pilih", o.pilih);
    const qs = u.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const listHref = href({});

  return (
    <>
      <AutoRefresh everyMs={10_000} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl">Konten</h1>
          <p className="text-sm text-text-2">
            {waiting > 0 ? `${waiting} menunggu keputusan kamu` : "Tidak ada yang menunggu keputusan kamu"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={base} role="search" className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            {tab !== "keputusan" && <input type="hidden" name="tab" value={tab} />}
            {kanal && <input type="hidden" name="kanal" value={kanal} />}
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              aria-label="Cari judul"
              placeholder="Cari judul"
              className="h-10 w-full rounded-md border border-border-input bg-surface pr-3 pl-9 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </form>
          <Button asChild variant="secondary">
            <Link href={`/o/${slug}/tugas`}>
              <History aria-hidden />
              Riwayat tugas
            </Link>
          </Button>
        </div>
      </div>

      <LinkTabs
        label="Keadaan konten"
        className="border-b border-border pb-2"
        items={CONTENT_TABS.map((t) => ({
          href: href({ tab: t, pilih: null }),
          label: TABS[t].label,
          count: all.filter((i) => i.tab === t && byChannel(i) && bySearch(i)).length,
          active: t === tab,
        }))}
      />

      {channels.length > 1 && (
        <LinkTabs
          label="Saring per channel"
          items={[
            { href: href({ kanal: null, pilih: null }), label: "Semua channel", count: all.filter((i) => i.tab === tab && bySearch(i)).length, active: !kanal },
            ...channels.map(([id, name]) => ({
              href: href({ kanal: id, pilih: null }),
              label: name,
              count: all.filter((i) => i.tab === tab && i.channel_id === id && bySearch(i)).length,
              active: kanal === id,
            })),
          ]}
        />
      )}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start">
        <section aria-label={TABS[tab].label} className={cn("min-w-0 flex-col gap-3", selected ? "hidden lg:flex" : "flex")}>
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong">
              <EmptyState
                icon={<Inbox aria-hidden />}
                title={q ? `Tidak ada judul yang cocok dengan "${q}"` : TABS[tab].empty}
                description={q || kanal ? "Coba hapus kata kunci atau pilih semua channel." : TABS[tab].emptyText}
                action={
                  q || kanal ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={href({ kanal: null, q: "", pilih: null })}>Tampilkan semua</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
              {items.map((i) => {
                const p = pill(i);
                const active = selected?.id === i.id;
                return (
                  <li key={i.id}>
                    <Link
                      href={href({ pilih: i.id })}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex flex-col gap-1.5 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl",
                        active ? "bg-accent-soft" : "hover:bg-surface-2/60",
                      )}
                    >
                      <span className="line-clamp-2 text-sm font-semibold text-text">{i.title}</span>
                      {i.detail && <span className="line-clamp-2 text-xs text-text-2">{i.kind === "run" && i.tab === "laporan" ? `oleh ${i.detail}` : i.detail}</span>}
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                        <StatusPill tone={p.tone}>{p.label}</StatusPill>
                        {i.channel_name && <span>{i.channel_name}</span>}
                        {i.revision > 0 && <span>revisi {i.revision}</span>}
                        <time dateTime={i.at}>{relativeTime(i.at, now)}</time>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside
          aria-label="Detail"
          className={cn(
            "min-w-0 flex-col gap-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:rounded-xl lg:border lg:border-border lg:bg-surface lg:p-5",
            selected ? "flex" : "hidden lg:flex",
          )}
        >
          {selected ? (
            selected.kind === "content" ? (
              <ContentDetail slug={slug} officeId={office.id} id={selected.id} backHref={listHref} backLabel="Kembali ke daftar" inPanel />
            ) : (
              <RunDetailView slug={slug} officeId={office.id} id={selected.id} backHref={listHref} />
            )
          ) : (
            <EmptyState
              icon={<Inbox aria-hidden />}
              title={items.length ? "Pilih salah satu" : TABS[tab].empty}
              description={items.length ? "Isi naskah, video, alasan gagal, atau laporannya tampil di sini." : "Pilih tab lain untuk melihat konten lainnya."}
            />
          )}
        </aside>
      </div>
    </>
  );
}
