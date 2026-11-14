"use client";

import { RadioGroup } from "radix-ui";
import { StatusPill, type StatusTone } from "./status-pill";
import { cn } from "@/lib/cn";

export type Option = {
  value: string;
  title: string;
  description?: string;
  status?: StatusTone;
  disabled?: boolean;
};

/** Pilihan berbentuk baris (otak AI, metode bayar). Opsi "Segera" disabled dengan alasan di deskripsi. */
export function OptionGroup({
  label,
  options,
  ...props
}: React.ComponentProps<typeof RadioGroup.Root> & { label: string; options: Option[] }) {
  return (
    <RadioGroup.Root aria-label={label} className="flex flex-col gap-2" {...props}>
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition-colors",
            "hover:border-border-strong data-[state=checked]:border-accent data-[state=checked]:bg-accent-soft",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-pill border border-border-input bg-surface group-data-[state=checked]:border-accent"
          >
            <span className="size-2 rounded-pill bg-accent opacity-0 group-data-[state=checked]:opacity-100" />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold text-text">{o.title}</span>
            {o.description && <span className="text-xs font-normal text-text-muted">{o.description}</span>}
          </span>
          {o.status && <StatusPill tone={o.status} />}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
