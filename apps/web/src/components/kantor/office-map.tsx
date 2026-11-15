"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import {
  BACKGROUND_URL,
  MAP_H,
  MAP_W,
  OWNER_SPOT,
  OWNER_URL,
  ROBOT_URL,
  SPRITE_H,
  spriteUrl,
  type CharacterId,
  type Pose,
} from "@/lib/office-map";

export type MapStatus = "working" | "waiting" | "ready" | "error";

export type MapAgent = {
  id: string;
  name: string;
  title: string;
  room: string;
  x: number;
  y: number;
  lift: number;
  /** null = robot asisten. */
  character: CharacterId | null;
  pose: Pose;
  status: MapStatus;
  activity: { lead: string; text: string } | null;
  href: string | null;
};

const DOT: Record<MapStatus | "offline", string> = {
  working: "bg-success",
  waiting: "bg-warning-dot",
  ready: "bg-text-muted",
  error: "bg-danger",
  offline: "bg-text-muted",
};
const LABEL: Record<MapStatus | "offline", string> = {
  working: "sedang bekerja",
  waiting: "menunggu kamu",
  ready: "siap",
  error: "bermasalah",
  offline: "istirahat, PC offline",
};

const pctX = (x: number) => `${(x / MAP_W) * 100}%`;
const pctY = (y: number) => `${(y / MAP_H) * 100}%`;

export function OfficeMap({
  agents,
  offline,
  approvalsHref,
  initialId,
}: {
  agents: MapAgent[];
  offline: boolean;
  approvalsHref: string;
  initialId?: string | null;
}) {
  const [selId, setSelId] = useState<string | null>(initialId ?? null);
  const sel = agents.find((a) => a.id === selId) ?? null;
  const owner = { h: SPRITE_H.owner, ...OWNER_SPOT };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border bg-surface-inverse">
        <div role="group" aria-label="Denah kantor" className="relative aspect-[3/2] min-w-[720px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- ilustrasi statis, diposisikan dalam persen */}
          <img
            src={BACKGROUND_URL}
            alt=""
            width={MAP_W}
            height={MAP_H}
            className={cn("absolute inset-0 size-full select-none", offline && "brightness-50 saturate-50")}
            draggable={false}
          />

          {agents.map((a) => {
            const h = a.character ? SPRITE_H[a.pose] : SPRITE_H.robot;
            return (
              <span key={`s-${a.id}`} aria-hidden>
                {a.id === selId && (
                  <span
                    className="absolute h-[3.5%] w-[6.5%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-accent shadow-[0_0_12px_var(--k-color-accent)]"
                    style={{ left: pctX(a.x), top: pctY(a.y - 4) }}
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- sprite kecil, ukuran dalam persen denah */}
                <img
                  src={a.character ? spriteUrl(a.character, a.pose) : ROBOT_URL}
                  alt=""
                  draggable={false}
                  className={cn("pointer-events-none absolute w-auto -translate-x-1/2 select-none", offline && "brightness-75 grayscale-[70%]")}
                  style={{ left: pctX(a.x), top: pctY(a.y - h), height: pctY(h) }}
                />
                {offline && (
                  <span
                    className="absolute text-xs font-extrabold text-on-inverse [text-shadow:0_1px_2px_var(--k-color-black)]"
                    style={{ left: pctX(a.x + h * 0.25), top: pctY(a.y - h - 6) }}
                  >
                    z z
                  </span>
                )}
              </span>
            );
          })}

          {/* eslint-disable-next-line @next/next/no-img-element -- sprite kecil, ukuran dalam persen denah */}
          <img
            src={OWNER_URL}
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none absolute w-auto -translate-x-1/2 select-none"
            style={{ left: pctX(owner.x), top: pctY(owner.y - owner.h), height: pctY(owner.h) }}
          />
          <span
            aria-hidden
            className="absolute inline-flex h-[22px] -translate-x-1/2 -translate-y-[calc(100%+4px)] items-center rounded-pill bg-surface px-2.5 text-xs font-extrabold whitespace-nowrap text-text shadow-pop"
            style={{ left: pctX(owner.x), top: pctY(owner.y - owner.h) }}
          >
            Kamu
          </span>

          {offline && (
            <p className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg border border-white/15 bg-surface-inverse/95 px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-on-inverse">
              PC offline: semua agent istirahat sampai PC menyala
            </p>
          )}

          {agents.map((a) => {
            const h = a.character ? SPRITE_H[a.pose] : SPRITE_H.robot;
            const st = offline ? "offline" : a.status;
            const selected = a.id === selId;
            const bubble = !offline && a.activity && (a.status === "waiting" || selected);
            return (
              <span key={`t-${a.id}`}>
                {bubble && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute z-20 flex w-44 flex-col rounded-lg border bg-surface-inverse/95 px-2.5 py-1.5 text-xs text-on-inverse shadow-pop",
                      a.status === "waiting" ? "border-warning-dot" : "border-white/15",
                    )}
                    style={{ left: pctX(a.x), top: pctY(a.y - h), transform: "translate(-50%, calc(-100% - 54px))" }}
                  >
                    <strong className={a.status === "waiting" ? "text-warning-dot" : "text-success"}>{a.activity!.lead}</strong>
                    <span className="truncate">{a.activity!.text}</span>
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${a.name}, ${a.title}, ${LABEL[st]}`}
                  onClick={() => setSelId(selected ? null : a.id)}
                  className={cn(
                    "absolute z-10 inline-flex h-[22px] items-center gap-1.5 rounded-pill border-2 bg-surface-inverse/95 px-2 text-xs font-bold whitespace-nowrap text-on-inverse shadow-pop",
                    selected ? "z-30 border-accent" : "border-white/15 hover:border-white/50",
                  )}
                  style={{ left: pctX(a.x), top: pctY(a.y - h), transform: `translate(-50%, calc(-100% - ${4 + a.lift}px))` }}
                >
                  <span aria-hidden className={cn("size-[7px] rounded-pill", DOT[st])} />
                  {a.name}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {sel ? (
        <Card className="flex items-start gap-4" aria-live="polite">
          <span aria-hidden className="inline-flex h-20 w-16 shrink-0 items-start justify-center overflow-hidden rounded-lg bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- potret sprite statis */}
            <img key={sel.id} src={sel.character ? spriteUrl(sel.character, "berdiri") : ROBOT_URL} alt="" className="mt-1 h-40 w-auto max-w-none" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-base font-semibold text-text">{sel.name}</span>
            <span className="truncate text-sm text-text-muted">
              {sel.title} · {sel.room}
            </span>
            <StatusPill tone={offline ? "offline" : sel.status} className="self-start">
              {offline ? "Istirahat" : undefined}
            </StatusPill>
            {sel.activity && (
              <span className="text-sm text-text-2">
                {sel.activity.lead} {sel.activity.text}
              </span>
            )}
          </span>
          <span className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {sel.status === "waiting" && (
              <Button asChild size="sm">
                <Link href={approvalsHref}>Periksa</Link>
              </Button>
            )}
            {sel.href && (
              <Button asChild size="sm" variant="secondary">
                <Link href={sel.href}>{sel.character ? "Buka agent" : "Chat asisten"}</Link>
              </Button>
            )}
          </span>
        </Card>
      ) : (
        <p className="text-sm text-text-muted">Klik label nama di denah untuk melihat apa yang sedang dikerjakan agent.</p>
      )}
    </div>
  );
}
