"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, InputGroup } from "@/components/ui/field";
import { OptionGroup } from "@/components/ui/option-group";
import { checkSlug, createOrderAction, type OrderFormState } from "./actions";

export function OrderForm({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState<OrderFormState, FormData>(createOrderAction, {});
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugCheck, setSlugCheck] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [checking, startCheck] = useTransition();
  const v = state.values ?? {};
  const slugError = state.errors?.slug ?? (slugCheck && !slugCheck.ok ? slugCheck.reason : undefined);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <Field label="Nama" error={state.errors?.name}>
        {(p) => <Input {...p} name="name" size="lg" autoComplete="name" defaultValue={v.name} required />}
      </Field>
      <Field label="Email" hint="Info pesanan dan link kantor dikirim ke alamat ini." error={state.errors?.email}>
        {(p) => <Input {...p} name="email" type="email" size="lg" autoComplete="email" inputMode="email" defaultValue={v.email} required />}
      </Field>
      <Field label="Nomor WhatsApp" hint="Untuk konfirmasi pembayaran." error={state.errors?.whatsapp}>
        {(p) => (
          <Input {...p} name="whatsapp" type="tel" size="lg" autoComplete="tel" inputMode="tel" placeholder="081234567890" defaultValue={v.whatsapp} required />
        )}
      </Field>
      <Field
        label="Alamat kantor"
        hint="3-30 huruf kecil, angka, atau tanda hubung. Alamat ini permanen."
        error={slugError}
      >
        {(p) => (
          <div className="flex flex-col gap-1.5">
            <InputGroup
              {...p}
              name="slug"
              size="lg"
              suffix={`.${domain}`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="studio-kamu"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugCheck(null);
              }}
              onBlur={() => slug && startCheck(async () => setSlugCheck(await checkSlug(slug)))}
              required
            />
            {checking && <p className="text-xs font-normal text-text-muted">Mengecek ketersediaan…</p>}
            {slugCheck?.ok && !state.errors?.slug && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success" role="status">
                <CheckCircle2 aria-hidden className="size-3.5" />
                {slug}.{domain} tersedia
              </p>
            )}
          </div>
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold text-text">Cara bayar</legend>
        <OptionGroup
          label="Cara bayar"
          name="method"
          defaultValue="manual"
          options={[
            { value: "manual", title: "Transfer bank", description: "Kirim bukti transfer lewat WhatsApp, kami konfirmasi manual." },
            { value: "midtrans", title: "QRIS, virtual account, e-wallet", description: "Lewat Midtrans, segera tersedia.", status: "soon", disabled: true },
          ]}
        />
      </fieldset>

      {state.errors?.form && <p role="alert" className="text-sm font-medium text-danger">{state.errors.form}</p>}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Buat pesanan
      </Button>
      <p className="text-xs font-normal text-text-muted">
        Data kamu hanya dipakai untuk pesanan ini dan untuk menghubungimu soal akun Kantoraiku.
      </p>
    </form>
  );
}
