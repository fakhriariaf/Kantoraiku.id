"use client";

import { useState } from "react";
import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/cn";

/** Pilihan tunggal yang selalu terisi, mis. Manual / Otomatis. */
export function SegmentedControl<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  label,
  className,
}: {
  options: { value: T; label: React.ReactNode }[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  label: string;
  className?: string;
}) {
  const [inner, setInner] = useState<T>(defaultValue ?? options[0].value);
  const current = value ?? inner;

  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={current}
      onValueChange={(v) => {
        if (!v) return; // tidak boleh kosong
        setInner(v as T);
        onValueChange?.(v as T);
      }}
      className={cn("inline-flex w-full rounded-md bg-surface-2 p-0.5 sm:w-auto", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="h-8 flex-1 rounded-sm px-4 text-sm font-semibold text-text-muted transition-colors hover:text-text data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-xs sm:flex-none"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

const DAYS = [
  { v: "1", short: "Sen", long: "Senin" },
  { v: "2", short: "Sel", long: "Selasa" },
  { v: "3", short: "Rab", long: "Rabu" },
  { v: "4", short: "Kam", long: "Kamis" },
  { v: "5", short: "Jum", long: "Jumat" },
  { v: "6", short: "Sab", long: "Sabtu" },
  { v: "7", short: "Min", long: "Minggu" },
];

/** Hari ISO (1 = Senin), sama dengan tasks.schedule_days. */
export function DayPicker({
  value,
  defaultValue = ["1", "2", "3", "4", "5", "6", "7"],
  onValueChange,
}: {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (days: string[]) => void;
}) {
  return (
    <ToggleGroup.Root
      type="multiple"
      aria-label="Hari"
      value={value}
      defaultValue={value ? undefined : defaultValue}
      onValueChange={onValueChange}
      className="flex flex-wrap gap-1.5"
    >
      {DAYS.map((d) => (
        <ToggleGroup.Item
          key={d.v}
          value={d.v}
          aria-label={d.long}
          className="size-10 rounded-pill border border-border text-xs font-semibold text-text-2 transition-colors hover:border-border-strong data-[state=on]:border-accent data-[state=on]:bg-accent-soft data-[state=on]:text-accent"
        >
          {d.short}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
