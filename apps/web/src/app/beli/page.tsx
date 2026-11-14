import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PricingCard } from "@/components/kantor/marketing";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";
import { config, publicDomain } from "@/server/config";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Buat kantor · Kantoraiku" };

export default function BeliPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto grid max-w-page gap-8 px-(--k-gutter) py-10 lg:grid-cols-[1fr_400px] lg:gap-12">
        <section aria-labelledby="judul" className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 id="judul" className="text-2xl">Buat kantor kamu</h1>
            <p className="text-base text-text-2">
              Isi data di bawah. Setelah pembayaran dikonfirmasi, kantor kamu langsung aktif.
            </p>
          </div>
          <OrderForm domain={publicDomain()} />
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PricingCard
            plan="Kantoraiku lifetime"
            price={config.priceLifetimeIdr}
            note="Sekali bayar, tanpa biaya bulanan."
            features={[
              "Agent konten: riset, naskah, persetujuan dari HP",
              "Alamat kantor sendiri",
              "Konektor untuk PC Windows",
              "Biaya AI langsung ke penyedia lewat API key kamu",
              "Semua pembaruan berikutnya",
            ]}
            cta={
              <Button asChild variant="secondary">
                <a href="#judul">Isi formulir</a>
              </Button>
            }
          />
        </aside>
      </main>
      <PublicFooter />
    </>
  );
}
