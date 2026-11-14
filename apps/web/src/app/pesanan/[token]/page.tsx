import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Banner, Skeleton } from "@/components/ui/feedback";
import { StatusPill } from "@/components/ui/status-pill";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { config, isDummyPaymentConfig, publicDomain } from "@/server/config";
import { getOrderByToken } from "@/server/orders";
import { dateTime, rupiah } from "@/lib/format";
import { startSetPassword } from "./actions";

export const metadata: Metadata = { title: "Pesanan · Kantoraiku", robots: { index: false } };

export default function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-(--k-gutter) py-10">
        <Suspense fallback={<OrderSkeleton />}>
          <OrderContent params={params} />
        </Suspense>
      </main>
      <PublicFooter />
    </>
  );
}

function OrderSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-sm font-semibold text-text sm:text-right">{children}</dd>
    </div>
  );
}

async function OrderContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const o = await getOrderByToken(token);
  if (!o) notFound();

  const address = `${o.office_slug}.${publicDomain()}`;
  const waText = `Halo, saya sudah transfer untuk pesanan ${o.code} (${rupiah(Number(o.amount))}) atas nama ${o.buyer_name}. Bukti transfer saya lampirkan.`;
  const waHref = `https://wa.me/${config.adminWhatsapp}?text=${encodeURIComponent(waText)}`;
  const setPassword = startSetPassword.bind(null, token);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Eyebrow>Pesanan {o.code}</Eyebrow>
        <h1 className="text-2xl">
          {o.status === "paid" ? "Kantor kamu sudah aktif" : o.status === "pending" ? "Selesaikan pembayaran" : "Pesanan tidak aktif"}
        </h1>
      </div>

      {o.status === "pending" && (
        <>
          <AutoRefresh everyMs={15_000} />
          {isDummyPaymentConfig() && process.env.NODE_ENV !== "production" && (
            <Banner tone="warning" title="Data rekening masih contoh">
              Ini lingkungan pengembangan. Jangan transfer ke rekening di bawah.
            </Banner>
          )}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg">Transfer bank</p>
              <StatusPill tone="waiting">Menunggu pembayaran</StatusPill>
            </div>
            <dl className="flex flex-col gap-3">
              <Row label="Jumlah">{rupiah(Number(o.amount))}</Row>
              <Row label="Bank">{config.manualBankName}</Row>
              <Row label="Nomor rekening"><span className="font-mono">{config.manualBankAccount}</span></Row>
              <Row label="Atas nama">{config.manualBankHolder}</Row>
              <Row label="Berita transfer"><span className="font-mono">{o.code}</span></Row>
              <Row label="Bayar sebelum">{dateTime(o.expires_at)} WIB</Row>
            </dl>
          </Card>
          <Card variant="flat" className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text-2">
              <li>Transfer sesuai jumlah di atas. Tulis kode pesanan di berita transfer.</li>
              <li>Kirim bukti transfer lewat WhatsApp dengan tombol di bawah.</li>
              <li>Setelah kami cek, halaman ini berubah dan kantor kamu aktif. Simpan link halaman ini.</li>
            </ol>
            <Button asChild size="lg">
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden />
                Kirim bukti lewat WhatsApp
              </a>
            </Button>
          </Card>
        </>
      )}

      {o.status === "paid" && (
        <>
          <Banner tone="success" title="Pembayaran diterima">
            Terima kasih, {o.buyer_name}. Langkah berikutnya: atur password, lalu sambungkan PC kamu.
          </Banner>
          <Card className="flex flex-col gap-5">
            <dl className="flex flex-col gap-3">
              <Row label="Alamat kantor"><span className="font-mono">{address}</span></Row>
              <Row label="Email login">{o.buyer_email}</Row>
              <Row label="Dibayar">{o.paid_at ? `${dateTime(o.paid_at)} WIB` : "-"}</Row>
            </dl>
            <form action={setPassword}>
              <Button type="submit" size="lg" className="w-full">
                Atur password dan buka kantor
              </Button>
            </form>
          </Card>
        </>
      )}

      {(o.status === "expired" || o.status === "cancelled" || o.status === "refunded") && (
        <Banner
          tone="danger"
          title={o.status === "expired" ? "Batas waktu pembayaran lewat" : o.status === "refunded" ? "Pesanan sudah dikembalikan dananya" : "Pesanan dibatalkan"}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/beli">Buat pesanan baru</Link>
            </Button>
          }
        >
          Kalau kamu sudah transfer, hubungi kami lewat WhatsApp dengan kode {o.code}.
        </Banner>
      )}
    </>
  );
}
