"use client";

import { Tooltip as RTooltip } from "radix-ui";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RTooltip.Provider delayDuration={300}>{children}</RTooltip.Provider>;
}

/** Hanya untuk info tambahan: HP tidak punya hover. */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          sideOffset={6}
          className="z-60 max-w-60 rounded-md bg-surface-inverse px-2.5 py-1.5 text-xs font-medium text-on-inverse shadow-pop animate-fade-in"
        >
          {content}
          <RTooltip.Arrow className="fill-surface-inverse" />
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
