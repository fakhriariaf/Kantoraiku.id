"use client";

import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = RDialog.Root;
export const DialogTrigger = RDialog.Trigger;
export const DialogClose = RDialog.Close;

/** Sheet dari bawah di HP, dialog di tengah mulai md. Fokus terkunci, Esc menutup. */
export function DialogContent({
  title,
  description,
  footer,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <RDialog.Portal>
      <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/40" />
      <RDialog.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop animate-sheet-up",
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6 md:animate-pop-in",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <RDialog.Title className="text-lg">{title}</RDialog.Title>
            {description ? (
              <RDialog.Description className="text-sm text-text-muted">{description}</RDialog.Description>
            ) : (
              <RDialog.Description className="sr-only">{title}</RDialog.Description>
            )}
          </div>
          <RDialog.Close
            aria-label="Tutup"
            className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <X aria-hidden className="size-4" />
          </RDialog.Close>
        </div>
        {children}
        {footer && (
          <div className="flex flex-col-reverse gap-2 pt-1 md:flex-row md:justify-end [&>*]:w-full md:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </RDialog.Content>
    </RDialog.Portal>
  );
}
