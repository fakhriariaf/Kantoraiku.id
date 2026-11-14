"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Toast as RToast } from "radix-ui";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type Item = { id: number; title: string; description?: string; tone: Tone };

const ToastCtx = createContext<(t: Omit<Item, "id">) => void>(() => {});

const icons = {
  success: <CheckCircle2 aria-hidden className="size-5 text-success" />,
  error: <XCircle aria-hidden className="size-5 text-danger" />,
  info: <Info aria-hidden className="size-5 text-info" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const push = useCallback((t: Omit<Item, "id">) => {
    setItems((xs) => [...xs, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {/* Di atas: bawah layar dipakai bottom nav (HP) dan tombol WhatsApp melayang. */}
      <RToast.Provider swipeDirection="right" label="Notifikasi">
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            type={t.tone === "error" ? "foreground" : "background"}
            duration={t.tone === "error" ? Infinity : 5000}
            onOpenChange={(open) => !open && setItems((xs) => xs.filter((x) => x.id !== t.id))}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-pop animate-fade-in data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[state=closed]:opacity-0"
          >
            {icons[t.tone]}
            <div className="flex flex-1 flex-col gap-0.5">
              <RToast.Title className="text-sm font-semibold text-text">{t.title}</RToast.Title>
              {t.description && (
                <RToast.Description className="text-sm text-text-muted">{t.description}</RToast.Description>
              )}
            </div>
            <RToast.Close
              aria-label="Tutup notifikasi"
              className="-mt-1 -mr-1 inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
            >
              <X aria-hidden className="size-4" />
            </RToast.Close>
          </RToast.Root>
        ))}
        <RToast.Viewport
          className={cn(
            "fixed inset-x-0 top-0 z-60 flex flex-col gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))] outline-none",
            "md:left-auto md:w-96",
          )}
        />
      </RToast.Provider>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
