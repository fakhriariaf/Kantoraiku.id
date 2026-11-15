import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { getRunDetail } from "@/server/content-list";
import { dateTime } from "@/lib/format";

const KIND: Record<string, string> = { general: "Tugas umum", research: "Riset", script: "Naskah", video: "Video", publish: "Posting", cs_reply: "Balas CS" };

/** Detail satu run di panel Konten: laporan tugas umum, atau alasan tugas gagal. */
export async function RunDetailView({ slug, officeId, id, backHref }: { slug: string; officeId: string; id: string; backHref: string }) {
  const r = await getRunDetail(officeId, id);
  return (
    <>
      <Link href={backHref} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-2 hover:text-text lg:hidden">
        <ArrowLeft aria-hidden className="size-4" />
        Kembali ke daftar
      </Link>
      {!r ? (
        <p className="text-sm text-text-muted">Tugas ini tidak ditemukan.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-text-muted">
              {KIND[r.task_kind] ?? r.task_kind}
              {r.channel_name && ` · ${r.channel_name}`}
            </p>
            <h2 className="text-xl">{r.task_name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
              <StatusPill tone={r.status === "failed" ? "error" : "info"}>{r.status === "failed" ? "Gagal" : "Laporan"}</StatusPill>
              <span>
                {r.agent_name}
                {r.finished_at && ` · ${dateTime(r.finished_at)}`}
              </span>
            </div>
          </div>
          {r.status === "failed" && (
            <Banner tone="danger" title="Kenapa gagal">
              {r.error ?? "PC tidak mengirim alasannya."}
            </Banner>
          )}
          {r.summary_md && <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-6 whitespace-pre-line text-text">{r.summary_md}</div>}
          <Button asChild variant="secondary" size="sm" className="self-start">
            <Link href={`/o/${slug}/tugas`}>{r.status === "failed" ? "Jalankan lagi dari Tugas" : "Lihat tugas"}</Link>
          </Button>
        </>
      )}
    </>
  );
}
