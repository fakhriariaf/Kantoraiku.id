"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";

/** Error internal Next (redirect, notFound) harus diteruskan supaya navigasinya tetap jalan. */
function isNextInternal(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_");
}

/**
 * Bungkus pemanggilan server action dari tombol/menu: bila jaringan putus atau server error,
 * pengguna mendapat toast yang jelas, bukan error tak tertangani tanpa umpan balik.
 * Mengembalikan undefined bila gagal.
 */
export function useServerCall() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (e) {
        if (isNextInternal(e)) throw e;
        toast({ title: "Gagal terhubung ke server", description: "Periksa koneksi internet, lalu coba lagi.", tone: "error" });
        return undefined;
      }
    },
    [toast],
  );
}
