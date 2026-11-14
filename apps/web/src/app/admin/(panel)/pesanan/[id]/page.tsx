import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/server/auth";
import { getOrder } from "@/server/orders";
import { officeUrl } from "@/server/config";
import { dateTime, rupiah } from "@/lib/format";
import { orderStatus } from "../../order-status";
import { ConfirmPayment } from "./confirm-payment";

export const metadata: Metadata = { title: "Detail pesanan · Admin Kantoraiku", robots: { index: false } };

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> };

export default function AdminOrderPage(props: P) {
  return (
    <>
      <Link href="/admin" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-text-2 hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        Semua pesanan
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Detail {...props} />
      </Suspense>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-medium break-words text-text">{children}</dd>
    </div>
  );
}

async function Detail({ params, searchParams }: P) {
  await requireAdmin();
  const [{ id }, { ok }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await getOrder(id);
  if (!o) notFound();
  const st = orderStatus[o.status];
  const wa = `https://wa.me/${o.buyer_whatsapp.replace(/^0/, "62").replace(/^\+/, "")}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow>Pesanan</Eyebrow>
          <h1 className="font-mono text-xl">{o.code}</h1>
        </div>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
      </div>

      {ok === "lunas" && (
        <Banner tone="success" title="Pembayaran dikonfirmasi, kantor sudah dibuat">
          Pembeli bisa membuka halaman pesanannya untuk mengatur password.
        </Banner>
      )}
      {ok === "batal" && <Banner tone="info" title="Pesanan dibatalkan" />}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <dl className="flex flex-col gap-3">
            <Row label="Pembeli">{o.buyer_name}</Row>
            <Row label="Email">{o.buyer_email}</Row>
            <Row label="WhatsApp">
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent underline-offset-4 hover:underline">
                <MessageCircle aria-hidden className="size-4" />
                {o.buyer_whatsapp}
              </a>
            </Row>
            <Row label="Alamat kantor"><span className="font-mono">{o.office_slug}</span></Row>
            <Row label="Nominal">{rupiah(Number(o.amount))}</Row>
            <Row label="Metode">{o.payment_method === "manual" ? "Transfer manual" : "Midtrans"}</Row>
            <Row label="Dibuat">{dateTime(o.created_at)} WIB</Row>
            <Row label="Batas bayar">{dateTime(o.expires_at)} WIB</Row>
            {o.paid_at && <Row label="Dibayar">{dateTime(o.paid_at)} WIB {o.confirmed_by_email && `· dikonfirmasi ${o.confirmed_by_email}`}</Row>}
            {o.admin_note && <Row label="Catatan admin">{o.admin_note}</Row>}
          </dl>
        </Card>

        <div className="flex flex-col gap-3">
          {(o.status === "pending" || o.status === "expired") && o.payment_method === "manual" ? (
            <ConfirmPayment orderId={o.id} code={o.code} amount={rupiah(Number(o.amount))} expired={o.status === "expired"} />
          ) : o.status === "paid" && o.office_id ? (
            <Card variant="flat" className="flex flex-col gap-3">
              <p className="text-sm text-text-2">Kantor aktif.</p>
              <Button asChild variant="secondary">
                <Link href={officeUrl(o.office_slug)}>Buka alamat kantor</Link>
              </Button>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
