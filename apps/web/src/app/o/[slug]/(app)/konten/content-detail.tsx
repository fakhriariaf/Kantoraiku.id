import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";
import { Banner } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { PipelineSteps, type Step } from "@/components/kantor/pipeline-steps";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { SectionTitle } from "@/components/shell/page-header";
import { getContent } from "@/server/office";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ContentApproval } from "./content-approval";
import { STAGE } from "./stage";
import { PublishButton } from "../jadwal/publish-button";

const DECISION = { approve: "Disetujui", revise: "Diminta revisi", reject: "Ditolak" } as const;

const VIDEO_STAGES = ["rendering", "video_review", "video_approved", "scheduled", "published"];

function steps(stage: string): Step[] {
  const reviewed = !["scripting", "script_review"].includes(stage);
  const videoState: Step["state"] =
    stage === "rendering" ? "active" : stage === "video_review" ? "waiting" : VIDEO_STAGES.includes(stage) ? "done" : "pending";
  return [
    { key: "research", label: "Riset", state: "done" },
    { key: "script", label: "Naskah", state: stage === "scripting" ? "active" : "done" },
    {
      key: "approval",
      label: "Persetujuan",
      state: stage === "script_review" ? "waiting" : stage === "rejected" ? "failed" : reviewed ? "done" : "pending",
      detail: stage === "rejected" ? "ditolak" : undefined,
    },
    { key: "video", label: "Video", state: videoState, detail: stage === "video_review" ? "menunggu kamu" : undefined },
    {
      key: "publish",
      label: "Terbit",
      state: stage === "published" ? "done" : stage === "scheduled" || stage === "video_approved" ? "waiting" : "pending",
      detail: stage === "scheduled" ? "terjadwal" : stage === "video_approved" ? "siap diposting" : undefined,
    },
  ];
}

/**
 * Isi satu konten: tahap, video, topik riset, naskah, rencana visual, riwayat, tombol keputusan.
 * Dipakai di halaman konten sendiri dan di panel kanan menu Konten (inPanel).
 * backHref: tujuan tombol kembali (null = tanpa tombol kembali).
 */
export async function ContentDetail({
  slug,
  officeId,
  id,
  backHref,
  backLabel = "Konten",
  inPanel,
}: {
  slug: string;
  officeId: string;
  id: string;
  backHref: string | null;
  backLabel?: string;
  inPanel?: boolean;
}) {
  const c = await getContent(officeId, id);
  if (!c && !inPanel) notFound();
  if (!c) return <p className="text-sm text-text-muted">Konten ini tidak ditemukan. Mungkin sudah dihapus.</p>;
  const pending = c.approvals.find((a) => !a.decision);
  const st = STAGE[c.stage];

  return (
    <>
      {(c.stage === "scripting" || c.stage === "rendering") && <AutoRefresh everyMs={8_000} />}
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-2 hover:text-text">
          <ArrowLeft aria-hidden className="size-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-2">
        <Eyebrow>{c.channel_name}{c.revision > 0 && ` · revisi ${c.revision}`}</Eyebrow>
        {inPanel ? <h2 className="text-xl">{c.title}</h2> : <h1 className="text-2xl">{c.title}</h1>}
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          <StatusPill tone={st?.tone ?? "ready"}>{st?.label ?? c.stage}</StatusPill>
          <span>{c.word_count ?? 0} kata · sekitar {c.duration_s ?? 0} detik</span>
        </div>
      </div>

      <Card>
        <PipelineSteps steps={steps(c.stage)} />
      </Card>

      {["video_approved", "scheduled", "published"].includes(c.stage) && (
        <Card variant="flat" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text">
            {c.stage === "published" && c.published_at
              ? `Sudah diposting ${dateTime(c.published_at)}.`
              : c.stage === "scheduled" && c.scheduled_at
                ? `Terjadwal ${dateTime(c.scheduled_at)}. Unggah video dari PC kamu pada jam itu, lalu tandai sudah diposting.`
                : "Video siap diposting. Channel ini belum punya jam posting, jadi tidak dijadwalkan otomatis."}
          </p>
          {c.stage !== "published" && <PublishButton slug={slug} contentId={c.id} title={c.title} size="md" />}
        </Card>
      )}

      {c.failure_reason && c.stage === "script_approved" && (
        <Banner tone="danger" title="Video gagal dibuat">
          {c.failure_reason} Perbaiki penyebabnya, lalu jalankan lagi tugas video dari halaman Tugas.
        </Banner>
      )}

      {VIDEO_STAGES.includes(c.stage) && c.stage !== "rendering" && c.video_local_ref && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Video</SectionTitle>
          <Card className="flex flex-col gap-4 sm:flex-row">
            {c.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed URL bucket privat, berganti tiap jam
              <img
                src={c.coverUrl}
                alt={`Cover video "${c.title}"`}
                width={180}
                height={320}
                className="aspect-[9/16] w-36 shrink-0 self-start rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-[9/16] w-36 shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-border-strong text-center text-xs text-text-muted">
                Cover belum ada
              </div>
            )}
            <dl className="grid min-w-0 flex-1 content-start gap-3 text-sm">
              <div>
                <dt className="text-xs font-normal text-text-muted">Durasi</dt>
                <dd className="text-text">{c.duration_s} detik</dd>
              </div>
              <div>
                <dt className="text-xs font-normal text-text-muted">File video</dt>
                <dd className="break-all text-text">
                  Tersimpan di {c.device_name ?? "PC kamu"}: <span className="font-mono text-xs">{c.video_local_ref}</span>
                </dd>
                <dd className="mt-1 text-xs font-normal text-text-muted">Video tidak diunggah ke server. Buka file di PC itu untuk menontonnya.</dd>
              </div>
              {c.video && (
                <div>
                  <dt className="text-xs font-normal text-text-muted">Suara</dt>
                  <dd className="text-text">
                    {c.video.voice === "elevenlabs" ? "Narasi ElevenLabs" : "Simulasi (tanpa suara): isi ELEVENLABS_API_KEY di konektor untuk narasi"}
                  </dd>
                </div>
              )}
              {c.video?.visual && (
                <div>
                  <dt className="text-xs font-normal text-text-muted">Visual</dt>
                  <dd className="text-text">
                    {c.video.visual === "ai_fal" || c.video.visual === "ai_openai"
                      ? `Gambar AI ${c.video.visual === "ai_fal" ? "fal FLUX" : "OpenAI"} (${c.video.ai_images ?? 0} gambar, digerakkan)`
                      : c.video.visual === "stock"
                        ? "Footage stok Pexels"
                        : "Latar polos"}
                  </dd>
                </div>
              )}
              {c.video && c.video.footage.length > 0 && (
                <div>
                  <dt className="text-xs font-normal text-text-muted">Footage</dt>
                  <dd>
                    <ul className="flex flex-col gap-1">
                      {c.video.footage.map((f) => (
                        <li key={f.url} className="text-text-2">
                          Video oleh{" "}
                          <a href={f.author_url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline-offset-4 hover:underline">
                            {f.author}
                          </a>{" "}
                          di{" "}
                          <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline-offset-4 hover:underline">
                            Pexels
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </section>
      )}

      {c.topic_title && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Topik dari riset</SectionTitle>
          <Card variant="flat" className="flex flex-col gap-2">
            <p className="text-base font-semibold text-text">{c.topic_title}</p>
            {c.topic_angle && <p className="text-sm text-text-2">{c.topic_angle}</p>}
            {c.topic_sources && c.topic_sources.length > 0 && (
              <ul className="flex flex-col gap-1">
                {c.topic_sources.map((s) => (
                  <li key={s.url}>
                    {/^https?:\/\//.test(s.url) ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline">
                        {s.title}
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-sm text-text-2">{s.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Naskah</SectionTitle>
        <Card>
          <p className="text-base leading-7 whitespace-pre-line text-text">{c.script ?? "Naskah sedang ditulis…"}</p>
        </Card>
      </section>

      {c.visual_plan.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Rencana visual</SectionTitle>
          <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {c.visual_plan.map((v, i) => (
              <li key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_1fr] sm:gap-4">
                <span className="text-sm text-text"><span className="font-mono text-xs text-text-muted">{String(i + 1).padStart(2, "0")} </span>{v.scene}</span>
                <span className="text-sm text-text-2">{v.visual}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {c.approvals.some((a) => a.decision) && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Riwayat keputusan</SectionTitle>
          <ul className="flex flex-col gap-2">
            {c.approvals.filter((a) => a.decision).map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                <span className="font-semibold text-text">{a.stage === "video" ? "Video" : "Naskah"}: {DECISION[a.decision as keyof typeof DECISION].toLowerCase()}</span>
                <span className="text-text-muted"> · revisi {a.revision} · {a.decided_at && dateTime(a.decided_at)}</span>
                {a.note && <p className="mt-1 text-text-2">“{a.note}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending && (
        <div
          className={cn(
            "sticky z-30 -mx-4 border-t border-border bg-surface/95 p-4 backdrop-blur md:mx-0 md:rounded-xl md:border md:p-5",
            inPanel ? "bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] md:bottom-4" : "bottom-[calc(var(--spacing-bottom-nav)+env(safe-area-inset-bottom))] md:static",
          )}
        >
          {c.revision >= c.max_revisions && (
            <p className="mb-3 text-sm text-text-2">
              Batas revisi ({c.max_revisions} kali) sudah tercapai: setujui atau tolak. Batasnya bisa diubah di Pengaturan › Kantor.
            </p>
          )}
          <ContentApproval
            slug={slug}
            approvalId={pending.id}
            stage={pending.stage === "video" ? "video" : "script"}
            revisionsLeft={Math.max(0, c.max_revisions - c.revision)}
          />
        </div>
      )}
    </>
  );
}
