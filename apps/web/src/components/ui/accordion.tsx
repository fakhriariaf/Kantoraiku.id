"use client";

import { Accordion as RAccordion } from "radix-ui";
import { ChevronDown } from "lucide-react";

export function Accordion({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <RAccordion.Root type="single" collapsible className="divide-y divide-border rounded-xl border border-border bg-surface">
      {items.map((it, i) => (
        <RAccordion.Item key={i} value={String(i)}>
          <RAccordion.Header asChild>
            <h3>
              <RAccordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-text hover:bg-surface-2/60">
                {it.q}
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-text-muted transition-transform group-data-[state=open]:rotate-180"
                />
              </RAccordion.Trigger>
            </h3>
          </RAccordion.Header>
          <RAccordion.Content className="px-5 pb-4 text-sm leading-6 text-text-2">{it.a}</RAccordion.Content>
        </RAccordion.Item>
      ))}
    </RAccordion.Root>
  );
}
