"use client";

import { Tabs as RTabs } from "radix-ui";
import { cn } from "@/lib/cn";

export const Tabs = RTabs.Root;
export const TabsContent = RTabs.Content;

export function TabsList({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <RTabs.List
      aria-label={label}
      className={cn("flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]", className)}
    >
      {children}
    </RTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        "-mb-px h-10 shrink-0 border-b-2 border-transparent px-3 text-sm font-semibold text-text-muted transition-colors hover:text-text data-[state=active]:border-accent data-[state=active]:text-text",
        className,
      )}
      {...props}
    />
  );
}
