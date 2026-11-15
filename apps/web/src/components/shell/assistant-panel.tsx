"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as RDialog } from "radix-ui";
import { Loader2, Maximize2, MessageCircle, X } from "lucide-react";
import { AssistantChat, type ChatItem } from "@/app/o/[slug]/(app)/asisten/assistant-ui";
import { loadChat } from "@/app/o/[slug]/(app)/asisten/actions";
import { useServerCall } from "@/lib/use-server-call";

/**
 * Tombol + panel samping Asisten. Bisa dibuka dari halaman mana pun lewat tombol atau Ctrl/Cmd J,
 * jadi pemilik tidak perlu meninggalkan halaman yang sedang dibuka untuk bertanya atau menyiapkan sesuatu.
 */
export function AssistantLauncher({ slug }: { slug: string }) {
  // Panel terbuka untuk halaman tempat ia dibuka; pindah halaman (mis. lewat tautan di chat) otomatis menutupnya.
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const [messages, setMessages] = useState<ChatItem[] | null>(null);
  const call = useServerCall();
  const router = useRouter();

  const reload = useCallback(async () => {
    const m = await call(() => loadChat(slug));
    if (m) setMessages(m);
  }, [call, slug]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenAt(next ? path : null);
      if (next) void reload();
    },
    [path, reload],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <RDialog.Trigger className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
        <MessageCircle aria-hidden className="size-4" />
        <span className="hidden xl:inline">Tanya Asisten</span>
        <span className="sr-only xl:hidden">Tanya Asisten</span>
        <kbd aria-hidden className="hidden rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-normal text-text-muted xl:inline">
          Ctrl J
        </kbd>
      </RDialog.Trigger>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/30" />
        <RDialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-4 bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop animate-fade-in sm:max-w-md sm:border-l sm:border-border"
        >
          <div className="flex items-center justify-between gap-2">
            <RDialog.Title className="text-lg">Asisten</RDialog.Title>
            <div className="flex items-center gap-1">
              <Link
                href={`/o/${slug}/asisten`}
                aria-label="Buka Asisten di halaman penuh"
                className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <Maximize2 aria-hidden className="size-4" />
              </Link>
              <RDialog.Close aria-label="Tutup" className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text">
                <X aria-hidden className="size-4" />
              </RDialog.Close>
            </div>
          </div>
          {messages === null ? (
            <p className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Memuat percakapan…
            </p>
          ) : (
            <AssistantChat
              slug={slug}
              messages={messages}
              compact
              onChange={async () => {
                await reload();
                router.refresh();
              }}
            />
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
