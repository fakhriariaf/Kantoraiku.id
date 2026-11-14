"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sealSecret, secretHint, type SecretKind } from "@kantoraiku/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useServerCall } from "@/lib/use-server-call";
import { removeKeyAction, saveKeyAction } from "./actions";

/**
 * Satu kunci untuk satu PC. Kunci dienkripsi DI BROWSER ke kunci publik PC (X25519),
 * jadi yang dikirim ke server hanya ciphertext + 4 karakter terakhir untuk tampilan.
 */
export function KeyRow({
  slug,
  deviceId,
  devicePublicKey,
  kind,
  label,
  hint,
  help,
  saved,
}: {
  slug: string;
  deviceId: string;
  devicePublicKey: string;
  kind: SecretKind;
  label: string;
  hint: string;
  help: string;
  saved: { hint: string | null; updatedAt: string } | null;
}) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const call = useServerCall();
  const inputId = `kunci-${deviceId}-${kind}`;

  const save = () =>
    start(async () => {
      setError(undefined);
      const secret = value.trim();
      if (secret.length < 8) return setError("Kunci terlalu pendek. Salin utuh dari situs penyedianya.");
      let sealed: string;
      try {
        sealed = await sealSecret(devicePublicKey, kind, secret);
      } catch {
        return setError("Browser ini belum mendukung enkripsi X25519. Perbarui browser (Chrome, Edge, Firefox, atau Safari terbaru).");
      }
      const r = await call(() => saveKeyAction(slug, deviceId, kind, sealed, secretHint(secret)));
      if (!r) return;
      if ("error" in r && r.error) return setError(r.error);
      setValue("");
      setEditing(false);
      toast({ title: `Kunci ${label} tersimpan`, description: "PC akan memakainya dalam satu menit.", tone: "success" });
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const ok = await call(async () => {
        await removeKeyAction(slug, deviceId, kind);
        return true;
      });
      if (!ok) return;
      setEditing(true);
      toast({ title: `Kunci ${label} dihapus dari PC ini`, tone: "success" });
      router.refresh();
    });

  return (
    <li className="flex flex-col gap-2 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-text">
          {label}
        </label>
        {saved && !editing && (
          <span className="font-mono text-sm text-text-2">
            <span className="sr-only">Tersimpan, berakhiran </span>••••{saved.hint ?? ""}
          </span>
        )}
      </div>
      <p className="text-xs font-normal text-text-muted">{help}</p>
      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={hint}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className="sm:flex-1"
          />
          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              Simpan untuk PC ini
            </Button>
            {saved && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(undefined);
                }}
              >
                Batal
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={`Ganti kunci ${label}`}>
            Ganti
          </Button>
          <Button variant="danger-ghost" size="sm" loading={pending} onClick={remove} aria-label={`Hapus kunci ${label}`}>
            Hapus
          </Button>
        </div>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
