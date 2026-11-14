import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { ChatThread, type ChatMessage } from "@/components/kantor/chat";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { requireMember } from "@/server/auth";
import { getConversation } from "@/server/cs";
import { timeOnly } from "@/lib/format";
import { HandOverButton, ReplyForm, ThreadSimulator } from "../cs-ui";

type P = { params: Promise<{ slug: string; id: string }> };

export default function ConversationPage({ params }: P) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-xl" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

const STATUS: Record<string, ChatMessage["status"]> = { sent: "sent", delivered: "delivered", read: "read" };

async function Conversation({ params }: P) {
  const { slug, id } = await params;
  const { office } = await requireMember(slug);
  const c = await getConversation(office.id, id);
  if (!c) notFound();
  const name = c.customer_name ?? c.customer_wa_id;
  const tz = office.timezone || "Asia/Jakarta";
  const messages: ChatMessage[] = c.messages.map((m) => ({
    id: m.id,
    from: m.sent_by,
    text: (m.body ?? `[${m.media?.type ?? "lampiran"}]`) + (m.status === "failed" ? `\n⚠ Gagal terkirim: ${m.error ?? "tanpa keterangan"}` : m.status === "queued" ? "\n(mengirim…)" : ""),
    time: timeOnly(m.created_at, tz),
    status: STATUS[m.status],
  }));
  const waiting = c.handled_by === "agent" && c.messages.at(-1)?.sent_by === "customer";

  return (
    <>
      <AutoRefresh everyMs={5_000} />
      <Link href={`/o/${slug}/cs`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-2 hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        CS WhatsApp
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">{name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <span className="font-mono">{c.mode === "simulation" ? "Simulasi" : `+${c.customer_wa_id}`}</span>
            <StatusPill tone={c.handled_by === "human" ? "waiting" : "working"}>
              {c.handled_by === "human" ? "Kamu yang membalas" : `Dibalas ${c.agent_name ?? "agent"}`}
            </StatusPill>
          </div>
        </div>
        <HandOverButton slug={slug} conversationId={c.id} handledBy={c.handled_by} />
      </div>

      {c.handled_by === "agent" && !c.agent_name && (
        <Banner tone="warning" title="Belum ada agent CS">
          Pilih agent CS di halaman CS WhatsApp supaya pesan pelanggan dibalas otomatis.
        </Banner>
      )}
      {c.mode === "cloud" && !c.in_window && (
        <Banner tone="info" title="Lewat 24 jam sejak pesan terakhir pelanggan">
          Aturan WhatsApp: pesan bebas baru bisa dikirim lagi setelah pelanggan mengirim pesan.
        </Banner>
      )}

      <Card className="flex flex-col gap-4">
        <ChatThread messages={messages} label={`Percakapan dengan ${name}`} />
        {waiting && <p className="text-xs font-normal text-text-muted">Agent sedang menyiapkan balasan. Konektor di PC harus menyala.</p>}
      </Card>

      <Card className="flex flex-col gap-5">
        <ReplyForm slug={slug} conversationId={c.id} />
        {c.mode === "simulation" && <ThreadSimulator slug={slug} customerName={name} />}
      </Card>
    </>
  );
}
