import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  Monitor,
  Server,
  Smartphone,
} from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { FloatingWhatsApp, PricingCard, formatRupiah } from "@/components/kantor/marketing";
import { FlowDemo } from "@/components/landing/flow-demo";
import { OfficePreview } from "@/components/landing/office-preview";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";
import { REFUND_DAYS, brains, planFeatures, requirements, roadmap } from "@/lib/offer";
import { config, hasRealWhatsapp } from "@/server/config";

export const metadata: Metadata = {
  title: "Kantoraiku · Kantor AI untuk konten kamu",
  description:
    "Agent AI yang meriset topik dan menulis naskah konten dari PC kamu. Kamu cukup menyetujui dari HP. Sekali bayar, tanpa langganan.",
};

const capabilities = [
  {
    icon: BriefcaseBusiness,
    title: "Agent dengan job desk sendiri",
    text: "Beri setiap agent nama, jabatan, dan uraian kerja. Pilih otak AI yang dipakai masing-masing.",
  },
  {
    icon: CalendarClock,
    title: "Tugas terjadwal dan berantai",
    text: "Riset jalan tiap pagi pukul 06.00, lalu penulis mulai begitu riset selesai. Tanpa kamu tekan apa pun.",
  },
  {
    icon: Smartphone,
    title: "Persetujuan dari HP",
    text: "Baca naskah, lalu setujui, minta revisi dengan catatan, atau tolak. Setiap keputusan tercatat.",
  },
  {
    icon: Activity,
    title: "Feed aktivitas kantor",
    text: "Lihat siapa sedang bekerja, apa yang sudah selesai, dan apa yang menunggu keputusan kamu.",
  },
];

const places = [
  {
    icon: Monitor,
    title: "PC kamu",
    tag: <StatusPill tone="info">wajib</StatusPill>,
    text: "Konektor Kantoraiku menjalankan agent dan menyimpan kunci AI kamu. Tugas yang jatuh tempo saat PC mati menunggu sampai PC menyala lagi.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    tag: <StatusPill tone="available">di browser</StatusPill>,
    text: "Atur agent, tugas, channel, dan persetujuan dari PC atau HP. Tetap bisa dibuka walau PC sedang mati.",
  },
  {
    icon: Server,
    title: "VPS kamu",
    tag: <StatusPill tone="soon" />,
    text: "Untuk agent yang perlu jalan 24 jam tanpa menunggu PC menyala.",
  },
];

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className={className}>
      <div className="mx-auto flex max-w-page flex-col gap-8 px-(--k-gutter) py-16 md:py-24">
        <div className="flex max-w-2xl flex-col gap-3">
          <Eyebrow className="text-accent">{eyebrow}</Eyebrow>
          <h2 id={`${id}-judul`} className="text-xl md:text-2xl">
            {title}
          </h2>
          {intro && <p className="text-base text-text-2 md:text-lead">{intro}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const price = formatRupiah(config.priceLifetimeIdr);

  const faq = [
    {
      q: "Kantoraiku itu apa?",
      a: "Dashboard untuk mengatur agent AI yang bekerja di PC kamu. Kamu menentukan tugas dan jadwalnya, agent mengerjakan riset dan naskah, lalu hasilnya masuk ke dashboard untuk kamu periksa.",
    },
    {
      q: "Apakah PC harus menyala terus?",
      a: "Agent hanya bekerja saat PC menyala dan konektor berjalan. Tugas yang jatuh tempo saat PC mati tidak hilang: tugas itu menunggu dan langsung dikerjakan begitu PC menyala. Dashboard sendiri bisa dibuka kapan saja.",
    },
    {
      q: "Berapa biaya AI-nya?",
      a: "Kantoraiku tidak menjual kuota AI. Agent memakai API key OpenAI milik kamu, jadi biayanya ditagih OpenAI langsung sesuai pemakaian. Kamu bisa memberi prioritas pada tugas supaya yang penting didahulukan.",
    },
    {
      q: "Di mana API key saya disimpan?",
      a: "Di PC kamu, di konfigurasi konektor. Kunci dipakai langsung dari PC ke penyedia AI. Server Kantoraiku hanya menerima keterangan bahwa kunci sudah terpasang, tidak pernah isinya.",
    },
    {
      q: "Bisa dipakai dari HP?",
      a: "Bisa. Dashboard dibuat untuk layar HP: daftar persetujuan, isi naskah, dan tombol keputusan ada di jangkauan jempol. Tidak perlu memasang aplikasi.",
    },
    {
      q: "Bagaimana cara bayarnya?",
      a: "Untuk sekarang lewat transfer bank. Setelah membuat pesanan, kirim bukti transfer lewat WhatsApp, lalu kantor aktif begitu pembayaran kami konfirmasi. Pembayaran QRIS, virtual account, dan e-wallet sedang disiapkan.",
    },
    {
      q: "Kapan video, posting otomatis, dan CS WhatsApp tersedia?",
      a: "Ketiganya sedang dibangun dan akan datang sebagai pembaruan. Pembelian lifetime sudah mencakupnya, tanpa biaya tambahan.",
    },
    {
      q: "Kalau ternyata tidak jalan di PC saya?",
      a: (
        <>
          Ada garansi {REFUND_DAYS} hari sejak kantor aktif. Bila konektor tidak bisa berjalan di PC yang memenuhi
          syarat dan kami tidak berhasil membantu, uang kamu kembali penuh. Rinciannya ada di{" "}
          <Link href="/kebijakan-refund" className="font-semibold text-accent underline underline-offset-2">
            Kebijakan Refund
          </Link>
          .
        </>
      ),
    },
    {
      q: "Konten yang dibuat agent milik siapa?",
      a: "Milik kamu. Karena itu setiap naskah bisa kamu periksa dulu sebelum dipakai: pastikan fakta, sumber, dan isinya sesuai aturan platform tempat kamu memposting.",
    },
  ];

  return (
    <>
      <PublicHeader />
      <main>
        <section aria-labelledby="hero-judul" className="border-b border-border bg-surface">
          <div className="mx-auto grid max-w-page items-center gap-12 px-(--k-gutter) py-14 md:grid-cols-[1.1fr_1fr] md:gap-10 md:py-20 lg:gap-12">
            <div className="flex flex-col gap-6">
              <Eyebrow className="text-accent">Kantor AI untuk kreator dan UMKM</Eyebrow>
              <h1 id="hero-judul" className="text-2xl lg:text-display">
                Tim konten AI yang bekerja dari PC kamu.
              </h1>
              <p className="max-w-xl text-base text-text-2 lg:text-lead">
                Agent periset mencari topik yang sedang ramai, agent penulis menyiapkan naskahnya. Kamu cukup membaca
                dan menyetujui dari HP.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/beli">
                    Buat kantor
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#cara-kerja">Lihat cara kerja</a>
                </Button>
              </div>
              <p className="text-sm text-text-muted">Sekali bayar {price}. Tanpa langganan bulanan.</p>
            </div>
            <OfficePreview />
          </div>
        </section>

        <Section
          id="fitur"
          eyebrow="Apa yang dikerjakan"
          title="Kantor kecil yang bekerja tiap hari"
          intro="Kamu yang menyusun timnya. Kantoraiku menjalankan jadwalnya, mengoper hasil kerja antar agent, dan mengumpulkan semua yang perlu kamu putuskan di satu tempat."
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((c) => (
              <li key={c.title}>
                <Card className="flex h-full flex-col gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <c.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold text-text">{c.title}</h3>
                  <p className="text-sm text-text-2">{c.text}</p>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Otak AI per agent</h3>
            <ul className="grid gap-3 sm:grid-cols-3">
              {brains.map((b) => (
                <li key={b.name}>
                  <Card variant="flat" className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-text">{b.name}</span>
                      <span className="text-xs font-normal text-text-muted">{b.how}</span>
                    </div>
                    <StatusPill tone={b.status} />
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="cara-kerja"
          eyebrow="Cara kerja"
          title="Satu konten, dari riset sampai siap terbit"
          intro="Pilih per channel: kamu periksa setiap naskah, atau biarkan agent jalan sendiri. Ganti kapan saja."
          className="border-y border-border bg-surface"
        >
          <FlowDemo />

          <div className="flex flex-col gap-4">
            <h3 className="text-lg">Di mana semuanya berjalan</h3>
            <ol className="grid gap-4 md:grid-cols-3">
              {places.map((p) => (
                <li key={p.title}>
                  <Card variant="flat" className="flex h-full flex-col gap-3 bg-bg">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-base font-semibold text-text">
                        <p.icon aria-hidden className="size-5 text-text-muted" />
                        {p.title}
                      </span>
                      {p.tag}
                    </div>
                    <p className="text-sm text-text-2">{p.text}</p>
                  </Card>
                </li>
              ))}
            </ol>
            <Card variant="flat" className="flex gap-4 border-accent bg-accent-soft">
              <KeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-text">Kunci AI tetap di PC kamu</h3>
                <p className="text-sm text-text-2">
                  API key disimpan di PC dan dipakai langsung dari sana ke penyedia AI. Server Kantoraiku hanya tahu
                  bahwa kunci sudah terpasang.
                </p>
              </div>
            </Card>
          </div>
        </Section>

        <Section
          id="segera"
          eyebrow="Sedang dibangun"
          title="Berikutnya: video, posting, dan CS"
          intro="Fitur berikut belum tersedia. Semuanya akan datang sebagai pembaruan, dan sudah termasuk dalam pembelian lifetime."
        >
          <ul className="grid gap-4 md:grid-cols-3">
            {roadmap.map((r) => (
              <li key={r.key}>
                <Card variant="dashed" className="flex h-full flex-col gap-3">
                  <StatusPill tone="soon" className="self-start" />
                  <h3 className="text-base font-semibold text-text">{r.title}</h3>
                  <p className="text-sm text-text-2">{r.text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          id="persiapan"
          eyebrow="Sebelum mulai"
          title="Yang perlu kamu siapkan"
          className="border-y border-border bg-surface"
        >
          <ul className="grid gap-4 md:grid-cols-3">
            {requirements.map((r) => (
              <li key={r.title}>
                <Card variant="flat" className="flex h-full flex-col gap-2 bg-bg">
                  <h3 className="text-base font-semibold text-text">{r.title}</h3>
                  <p className="text-sm text-text-2">{r.text}</p>
                </Card>
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">
            Kantoraiku tidak menjual atau menagih kuota AI. Biaya penyedia AI kamu bayar langsung ke penyedianya.
          </p>
        </Section>

        <section id="harga" aria-labelledby="harga-judul">
          <div className="mx-auto grid max-w-page items-start gap-10 px-(--k-gutter) py-16 md:py-24 lg:grid-cols-[1fr_420px]">
            <div className="flex flex-col gap-4">
              <Eyebrow className="text-accent">Harga</Eyebrow>
              <h2 id="harga-judul" className="text-xl md:text-2xl">
                Sekali bayar, kantornya milik kamu
              </h2>
              <p className="max-w-xl text-base text-text-2 md:text-lead">
                Tidak ada biaya bulanan dari Kantoraiku. Kamu hanya membayar pemakaian AI langsung ke penyedianya.
              </p>
              <p className="max-w-xl text-sm text-text-2">
                Garansi {REFUND_DAYS} hari: bila konektor tidak bisa berjalan di PC kamu, uang kembali penuh.{" "}
                <Link href="/kebijakan-refund" className="font-semibold text-accent underline underline-offset-2">
                  Baca kebijakan refund
                </Link>
              </p>
            </div>
            <PricingCard
              plan="Kantoraiku lifetime"
              price={config.priceLifetimeIdr}
              note="Sekali bayar, berlaku seumur layanan."
              features={planFeatures}
              cta={
                <Button asChild size="lg">
                  <Link href="/beli">
                    Buat kantor
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            />
          </div>
        </section>

        <Section id="faq" eyebrow="Tanya jawab" title="Yang sering ditanyakan" className="border-t border-border bg-surface">
          <div className="max-w-3xl">
            <Accordion items={faq} />
          </div>
        </Section>

        <section aria-labelledby="ajakan-judul" className="bg-surface-inverse">
          <div className="mx-auto flex max-w-page flex-col items-start gap-5 px-(--k-gutter) py-14 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <h2 id="ajakan-judul" className="text-xl text-on-inverse">
                Siapkan kantor kamu hari ini
              </h2>
              <p className="text-sm text-on-inverse">Isi empat data, transfer, lalu pasang konektor di PC kamu.</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link href="/beli">
                Buat kantor
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <PublicFooter />
      {hasRealWhatsapp() && <FloatingWhatsApp phone={config.adminWhatsapp} text="Halo, saya mau tanya soal Kantoraiku." />}
    </>
  );
}
