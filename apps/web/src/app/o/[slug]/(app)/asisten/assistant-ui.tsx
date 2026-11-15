"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { describeProposal, type AssistantMessage, type ProposalState, type Reply } from "@/lib/assistant";
import { ROBOT_URL } from "@/lib/office-map";
import { useServerCall } from "@/lib/use-server-call";
import { command, confirm, send, skip, type SendState } from "./actions";

export type ChatItem = AssistantMessage & { time: string };

const INTRO: Reply[] = [
  { label: "Mulai setup", value: "mulai" },
  { label: "Lihat menu", value: "menu" },
];

export function AssistantChat({ slug, messages }: { slug: string; messages: ChatItem[] }) {
  const [busy, start] = useTransition();
  const call = useServerCall();
  const end = useRef<HTMLDivElement>(null);
  const base = `/o/${slug}`;
  const last = messages.at(-1);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const run = (fn: () => Promise<void>) => start(async () => void (await call(fn)));
  const replies = messages.length === 0 ? INTRO : last?.role === "assistant" ? (last.data.replies ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div role="log" aria-label="Percakapan dengan Asisten" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:p-5">
        <ol className="flex flex-col gap-3">
          {messages.length === 0 && (
            <Bubble mine={false} time="">
              <p>
                Halo, aku Asisten. Aku bantu menyiapkan kantormu langkah demi langkah: PC, channel, agent, skill, dan tugas.
                {"\n\n"}Setiap kali aku mau membuat sesuatu, aku tunjukkan dulu isinya dan kamu yang memutuskan.
              </p>
            </Bubble>
          )}
          {messages.map((m) => (
            <Bubble key={m.id} mine={m.role === "user"} time={m.time}>
              <p>{m.body}</p>
              {m.data.proposal && (
                <ProposalCard
                  p={m.data.proposal}
                  base={base}
                  busy={busy}
                  onConfirm={() => run(() => confirm(slug, m.id))}
                  onSkip={() => run(() => skip(slug, m.id))}
                />
              )}
              {m.data.links && m.data.links.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {m.data.links.map((l) => (
                    <Button key={l.href + l.label} asChild size="sm" variant="secondary">
                      <Link href={base + l.href}>
                        {l.label}
                        <ArrowUpRight aria-hidden />
                      </Link>
                    </Button>
                  ))}
                </span>
              )}
            </Bubble>
          ))}
        </ol>
        {busy && (
          <p className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Asisten sedang menyiapkan…
          </p>
        )}
        {replies.length > 0 && (
          <div role="group" aria-label="Balasan cepat" className="flex flex-wrap gap-2">
            {replies.map((r) => (
              <button
                key={r.value}
                type="button"
                disabled={busy}
                onClick={() => run(() => command(slug, r.value, r.label))}
                className="h-9 rounded-pill border border-accent px-3.5 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>

      <SendForm slug={slug} disabled={busy} />
    </div>
  );
}

function Bubble({ mine, time, children }: { mine: boolean; time: string; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <span aria-hidden className="inline-flex size-9 shrink-0 items-start justify-center overflow-hidden rounded-pill bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- sprite statis */}
          <img src={ROBOT_URL} alt="" className="mt-0.5 h-12 w-auto max-w-none" />
        </span>
      )}
      <div
        className={cn(
          "flex max-w-[92%] flex-col rounded-lg px-3.5 py-2.5 text-sm leading-5 whitespace-pre-line sm:max-w-[75%]",
          mine ? "rounded-br-md bg-accent-soft text-text" : "rounded-bl-md border border-border bg-surface-2/60 text-text",
        )}
      >
        <span className="sr-only">{mine ? "Kamu" : "Asisten"}: </span>
        {children}
        {time && <span className="mt-1 self-end text-xs font-normal text-text-muted">{time}</span>}
      </div>
    </li>
  );
}

function ProposalCard({ p, base, busy, onConfirm, onSkip }: { p: ProposalState; base: string; busy: boolean; onConfirm: () => void; onSkip: () => void }) {
  const d = describeProposal(p);
  if (p.status === "replaced") {
    return (
      <section aria-label={`Usulan: ${d.title}`} className="mt-2.5 rounded-lg border border-dashed border-border-strong px-3.5 py-2 text-sm whitespace-normal text-text-muted">
        {d.title}: diganti usulan baru
      </section>
    );
  }
  return (
    <section aria-label={`Usulan: ${d.title}`} className="mt-2.5 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5 whitespace-normal">
      <h3 className="text-sm font-bold text-text">{d.title}</h3>
      <dl className="flex flex-col gap-2">
        {d.rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-text-muted">{k}</dt>
            <dd className="line-clamp-6 text-sm whitespace-pre-line text-text-2">{v}</dd>
          </div>
        ))}
      </dl>
      {p.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            {d.confirm}
          </Button>
          <Button size="sm" variant="secondary" onClick={onSkip} disabled={busy}>
            Lewati
          </Button>
        </div>
      )}
      {p.status === "running" && <p className="text-sm text-text-muted">Sedang dibuat…</p>}
      {p.status === "done" && (
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-success">
          <Check aria-hidden className="size-4" />
          Sudah dibuat
          {p.href !== undefined && (
            <Link href={base + p.href} className="font-semibold text-accent underline underline-offset-2">
              Lihat
            </Link>
          )}
        </p>
      )}
      {p.status === "skipped" && <p className="text-sm text-text-muted">Dilewati</p>}
    </section>
  );
}

function SendForm({ slug, disabled }: { slug: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<SendState, FormData>(send.bind(null, slug), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <Field label="Pesan untuk Asisten" error={state.error}>
          {(p) => <Input {...p} name="pesan" maxLength={1000} autoComplete="off" defaultValue={state.value} placeholder="Ketik jawaban, atau mis. buat agent" />}
        </Field>
      </div>
      <Button type="submit" loading={pending} disabled={disabled} className={cn(state.error ? "mb-6" : "")}>
        Kirim
      </Button>
    </form>
  );
}
