"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Muat ulang data server secara berkala selama tab terlihat.
 * Pengganti sementara Supabase Realtime (dipasang di /replica-backend).
 */
export function AutoRefresh({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
