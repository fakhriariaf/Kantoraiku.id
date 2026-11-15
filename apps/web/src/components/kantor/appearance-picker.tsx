"use client";

import { useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  BACKGROUND_URL,
  CHARACTER_FILTERS,
  CHARACTERS,
  MAP_H,
  MAP_W,
  ROOMS,
  SPRITE_H,
  characterDesc,
  previewSpot,
  roomFor,
  spriteUrl,
  type CharacterId,
} from "@/lib/office-map";

type FilterId = (typeof CHARACTER_FILTERS)[number]["id"];

const BOX_W = 288;
const BOX_H = 188;
const K = 1.2;

/** Pilih satu dari 12 karakter untuk agent, dengan pratinjau di kursinya. Dikirim sebagai field "appearance". */
export function AppearancePicker({ defaultValue, name, title }: { defaultValue: CharacterId | null; name: string; title: string }) {
  const [sel, setSel] = useState<CharacterId | null>(defaultValue);
  const [filter, setFilter] = useState<FilterId>("semua");
  const shown = (c: (typeof CHARACTERS)[number]) => filter === "semua" || (c.tags as readonly string[]).includes(filter);
  const spot = previewSpot(title);
  const room = ROOMS[roomFor(title)].label;
  const h = SPRITE_H[spot.pose] * K;

  function shuffle() {
    const pool = CHARACTERS.filter((c) => shown(c) && c.id !== sel);
    if (pool.length) setSel(pool[Math.floor(Math.random() * pool.length)].id);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1.5 text-sm font-semibold text-text">Penampilan</legend>
      <p className="-mt-1 text-sm text-text-muted">Tampilan agent di denah kantor. Hanya tampilan, tidak mengubah cara kerjanya.</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <div role="group" aria-label="Saring karakter" className="flex flex-wrap gap-1.5">
              {CHARACTER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "h-8 rounded-pill border px-3 text-xs font-semibold transition-colors",
                    filter === f.id ? "border-accent bg-accent text-on-accent" : "border-border bg-surface text-text hover:border-border-strong",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={shuffle}
              className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-dashed border-border-strong bg-surface px-3 text-xs font-semibold text-text hover:border-accent"
            >
              <Shuffle aria-hidden className="size-3.5" />
              Acak
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
            {CHARACTERS.map((c) => {
              const on = sel === c.id;
              return (
                <label
                  key={c.id}
                  className={cn(
                    "relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 bg-surface px-1.5 pt-2 pb-1.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    on ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                    !shown(c) && !on && "hidden",
                  )}
                >
                  <input type="radio" name={name} value={c.id} checked={on} onChange={() => setSel(c.id)} className="sr-only" />
                  <span aria-hidden className="flex h-24 items-end justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- sprite statis */}
                    <img src={spriteUrl(c.id, "berdiri")} alt="" className="h-24 w-auto" draggable={false} />
                  </span>
                  <span className="text-xs leading-tight font-medium text-text-2">{c.desc}</span>
                  {on && (
                    <span aria-hidden className="absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-pill bg-accent text-on-accent">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-72">
          <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Pratinjau di {room}</p>
          <div
            role="img"
            aria-label={sel ? `Pratinjau: ${characterDesc(sel)}, di ${room}` : `Pratinjau kursi di ${room}, karakter belum dipilih`}
            className="relative overflow-hidden rounded-lg bg-surface-inverse"
            style={{ width: BOX_W, height: BOX_H }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- potongan gambar latar */}
            <img
              src={BACKGROUND_URL}
              alt=""
              draggable={false}
              className="absolute max-w-none"
              style={{ width: MAP_W * K, height: MAP_H * K, left: BOX_W / 2 - spot.x * K, top: BOX_H - 18 - spot.y * K }}
            />
            {sel && (
              // eslint-disable-next-line @next/next/no-img-element -- sprite statis
              <img
                src={spriteUrl(sel, spot.pose)}
                alt=""
                draggable={false}
                className="absolute w-auto max-w-none -translate-x-1/2"
                style={{ left: BOX_W / 2, top: BOX_H - 18 - h, height: h }}
              />
            )}
          </div>
          <p className="text-sm text-text-2">
            {sel ? characterDesc(sel) : "Belum dipilih: karakter dipilihkan otomatis saat disimpan."}
          </p>
        </div>
      </div>
    </fieldset>
  );
}
