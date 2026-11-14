"use client";

import { useState } from "react";
import { Bell, Inbox, Plus, RefreshCw, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, InputGroup, Select, Textarea } from "@/components/ui/field";
import { SegmentedControl, DayPicker } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { Chip } from "@/components/ui/chip";
import { AddCard, Card, Eyebrow } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { OptionGroup } from "@/components/ui/option-group";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { DataTable } from "@/components/ui/data-table";
import { AgentCard } from "@/components/kantor/agent-card";
import { ActivityToast, Feed, type FeedEvent } from "@/components/kantor/feed";
import { PipelineSteps } from "@/components/kantor/pipeline-steps";
import { ApprovalActions } from "@/components/kantor/approval-actions";
import { DeviceCard, SetupCode } from "@/components/kantor/device";
import { ChatThread } from "@/components/kantor/chat";
import { FloatingWhatsApp, PricingCard, formatRupiah } from "@/components/kantor/marketing";
import { TemplateCard } from "@/components/kantor/template-card";

const COLORS = [
  "bg", "surface", "surface-2", "surface-inverse", "border", "border-strong", "border-input",
  "text", "text-2", "text-muted", "accent", "accent-hover", "accent-soft",
  "danger", "danger-soft", "success", "success-soft", "warning", "warning-soft", "warning-dot", "info", "info-soft",
];

const TYPE = [
  { cls: "text-display", name: "display 48 (HP 36) / 800" },
  { cls: "text-2xl", name: "2xl 32 / 700" },
  { cls: "text-xl", name: "xl 24 / 700" },
  { cls: "text-lg", name: "lg 20 / 600" },
  { cls: "text-lead", name: "lead 18 / 400" },
  { cls: "text-base", name: "base 16 / 400" },
  { cls: "text-sm", name: "sm 14 / 400" },
  { cls: "text-xs", name: "xs 12 / 500" },
];

const EVENTS: FeedEvent[] = [
  { id: "e1", agentId: "a2", agentName: "Sari", text: "mengajukan naskah untuk disetujui", role: "Penulis naskah", at: "2026-11-14T02:41:00Z", timeLabel: "baru saja", unread: true },
  { id: "e2", agentId: "a1", agentName: "Bayu", text: "menemukan 3 topik yang sedang ramai", role: "Periset", at: "2026-11-14T02:30:00Z", timeLabel: "11 menit lalu" },
  { id: "e3", agentId: "a3", agentName: "Laras", text: "membalas 4 chat pelanggan", role: "CS WhatsApp", at: "2026-11-14T01:55:00Z", timeLabel: "46 menit lalu" },
];

type Order = { code: string; buyer: string; method: string; amount: number; status: StatusTone; statusLabel: string };
const ORDERS: Order[] = [
  { code: "KTR-261114-A7Q2", buyer: "Dewi Lestari", method: "Transfer manual", amount: 299000, status: "waiting", statusLabel: "Menunggu konfirmasi" },
  { code: "KTR-261113-K9P1", buyer: "Rudi Hartono", method: "Transfer manual", amount: 299000, status: "online", statusLabel: "Lunas" },
  { code: "KTR-261112-M3X8", buyer: "Nadia Putri", method: "Transfer manual", amount: 299000, status: "offline", statusLabel: "Kedaluwarsa" },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-5 border-t border-border py-10">
      <h2 id={`${id}-h`} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{label}</Eyebrow>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export function DesignSystem() {
  const toast = useToast();
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [brain, setBrain] = useState("claude");
  const [paused, setPaused] = useState(false);
  const [template, setTemplate] = useState("kapur");
  const [slugError, setSlugError] = useState(true);

  return (
    <main className="mx-auto max-w-page px-(--k-gutter) pb-24">
      <header className="flex flex-col gap-3 py-10">
        <Eyebrow className="text-accent">Kantoraiku · sistem desain</Eyebrow>
        <h1 className="text-2xl md:text-display">Komponen dasar</h1>
        <p className="max-w-2xl text-lead text-text-2">
          Semua warna, ukuran, dan radius berasal dari <code className="font-mono text-sm">replica/design/tokens.json</code>.
          Warna di halaman ini masih netral sementara; nilai final datang dari /replica-brand.
        </p>
      </header>

      <Section id="warna" title="Warna (peran)">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {COLORS.map((c) => (
            <li key={c} className="flex flex-col gap-1.5">
              <span className="h-14 rounded-lg border border-border" style={{ background: `var(--k-color-${c})` }} />
              <span className="font-mono text-xs text-text-2">{c}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="tipografi" title="Tipografi">
        <div className="flex flex-col gap-4">
          {TYPE.map((t) => (
            <div key={t.cls} className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-6">
              <span className="w-44 shrink-0 font-mono text-xs text-text-muted">{t.name}</span>
              <span className={t.cls}>Agent kamu bekerja selagi kamu tidur.</span>
            </div>
          ))}
          <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:gap-6">
            <span className="w-44 shrink-0 font-mono text-xs text-text-muted">eyebrow mono 11 / 600</span>
            <Eyebrow>Dari riset sampai terbit</Eyebrow>
          </div>
        </div>
      </Section>

      <Section id="bentuk" title="Radius dan bayangan">
        <div className="flex flex-wrap gap-4">
          {["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-pill"].map((r) => (
            <div key={r} className={`flex h-16 w-28 items-center justify-center border border-border-strong bg-surface font-mono text-xs ${r}`}>
              {r.replace("rounded-", "")}
            </div>
          ))}
          {["shadow-xs", "shadow-card", "shadow-pop"].map((s) => (
            <div key={s} className={`flex h-16 w-28 items-center justify-center rounded-lg bg-surface font-mono text-xs ${s}`}>
              {s.replace("shadow-", "")}
            </div>
          ))}
        </div>
      </Section>

      <Section id="tombol" title="Tombol">
        <Row label="Varian">
          <Button>Utama</Button>
          <Button variant="secondary">Sekunder</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Hapus</Button>
          <Button variant="danger-ghost">Tolak</Button>
        </Row>
        <Row label="Ukuran">
          <Button size="sm">Kecil 32</Button>
          <Button>Sedang 40</Button>
          <Button size="lg">Besar 48</Button>
          <Tooltip content="Tambah agent">
            <Button size="icon" variant="secondary" aria-label="Tambah agent">
              <Plus aria-hidden />
            </Button>
          </Tooltip>
        </Row>
        <Row label="State">
          <Button loading>Menyimpan</Button>
          <Button disabled>Nonaktif</Button>
          <Button variant="secondary">
            <RefreshCw aria-hidden />
            Dengan ikon
          </Button>
        </Row>
      </Section>

      <Section id="form" title="Form">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Email" hint="Detail akses kantor dikirim ke email ini.">
            {(p) => <Input {...p} type="email" placeholder="nama@email.com" autoComplete="email" />}
          </Field>
          <Field
            label="Alamat kantor"
            hint="3-30 huruf kecil, angka, atau tanda hubung. Tidak bisa diganti setelah kantor dibuat."
            error={slugError ? "Alamat ini sudah dipakai. Coba yang lain." : undefined}
          >
            {(p) => (
              <InputGroup
                {...p}
                defaultValue="studio-budi"
                suffix=".kantoraiku.id"
                onChange={() => setSlugError(false)}
              />
            )}
          </Field>
          <Field label="Job desk" hint="Tulis tugas agent seperti menulis untuk karyawan baru.">
            {(p) => <Textarea {...p} placeholder="Cari 3 topik yang sedang ramai di niche channel, lengkap dengan sumbernya." />}
          </Field>
          <div className="flex flex-col gap-6">
            <Field label="Bahasa konten">
              {(p) => (
                <Select {...p} defaultValue="id">
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </Select>
              )}
            </Field>
            <Field label="Nama" hint="Nonaktif">
              {(p) => <Input {...p} disabled value="Studio Budi" readOnly />}
            </Field>
          </div>
        </div>

        <Row label="Mode channel">
          <SegmentedControl
            label="Mode channel"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "manual", label: "Manual" },
              { value: "auto", label: "Otomatis" },
            ]}
          />
          <span className="text-sm text-text-muted">
            {mode === "manual" ? "Naskah dan video menunggu persetujuanmu." : "Semua jalan tanpa menunggu kamu."}
          </span>
        </Row>

        <Row label="Hari tugas">
          <DayPicker defaultValue={["1", "2", "3", "4", "5"]} />
        </Row>

        <div className="grid gap-6 md:grid-cols-2">
          <Card variant="flat" className="flex flex-col gap-4">
            <Switch label="Tugas aktif" description="Jalan setiap hari pukul 06.00." defaultChecked />
            <Switch label="Mode hemat" description="Lewati tugas prioritas rendah saat anggaran AI hampir habis." />
          </Card>
          <OptionGroup
            label="Otak AI"
            value={brain}
            onValueChange={setBrain}
            options={[
              { value: "claude", title: "Claude", description: "Pakai API key Anthropic kamu", status: "available" },
              { value: "openai", title: "OpenAI", description: "Pakai API key OpenAI kamu", status: "available" },
              { value: "chatgpt", title: "Login ChatGPT", description: "Menunggu persetujuan OpenAI", status: "soon", disabled: true },
            ]}
          />
        </div>
      </Section>

      <Section id="status" title="Status, chip, avatar">
        <Row label="StatusPill">
          {(["working", "waiting", "ready", "error", "online", "offline", "available", "soon", "info"] as StatusTone[]).map((t) => (
            <StatusPill key={t} tone={t} />
          ))}
        </Row>
        <Row label="Chip">
          <Chip>Riset tren</Chip>
          <Chip variant="outline">TikTok</Chip>
          <Chip variant="outline">Instagram</Chip>
          <Chip variant="tag">bawaan</Chip>
          <Chip variant="tag">opsional</Chip>
          <Chip onRemove={() => toast({ title: "Skill dilepas", tone: "info" })}>Naskah pendek</Chip>
        </Row>
        <Row label="Avatar">
          {["Bayu", "Sari", "Laras", "Dimas", "Wulan", "Agus", "Tari", "Asisten"].map((n) => (
            <Avatar key={n} name={n} decorative={false} />
          ))}
          <Avatar name="Bayu" size="sm" />
          <Avatar name="Bayu" size="lg" />
        </Row>
      </Section>

      <Section id="agent" title="Kartu agent">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AgentCard id="a1" name="Bayu" title="Periset" status="working" skills={["Riset tren", "Cari sumber"]} schedule="Setiap hari pukul 06.00" />
          <AgentCard id="a2" name="Sari" title="Penulis naskah" status="waiting_user" skills={["Naskah pendek", "Gaya channel"]} schedule="Setelah Bayu selesai" />
          <AgentCard id="a0" name="Asisten" title="Asisten setup" status="idle" skills={[]} schedule="Saat kamu ajak bicara" builtin />
          <AgentCard id="a3" name="Laras" title="CS WhatsApp" status="error" skills={["Info produk"]} schedule="Membalas kapan saja" />
          <AddCard title="Buat agent baru" description="Tulis job desk, pasang skill, atur jadwal." />
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-9 w-9 rounded-pill" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-3/4" />
          </Card>
        </div>
      </Section>

      <Section id="aktivitas" title="Aktivitas">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <Feed events={EVENTS} />
          </Card>
          <ActivityToast e={EVENTS[0]} office="Studio Budi" />
        </div>
      </Section>

      <Section id="pipeline" title="Pipeline dan persetujuan">
        <Card>
          <PipelineSteps
            steps={[
              { key: "research", label: "Riset", state: "done", detail: "3 topik · 06.02" },
              { key: "script", label: "Naskah", state: "done", detail: "118 kata · 47 detik" },
              { key: "approval", label: "Persetujuan", state: "waiting" },
              { key: "video", label: "Video", state: "pending" },
              { key: "publish", label: "Terbit", state: "pending", detail: "terjadwal 16.00" },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-lg">Kenapa langit sore berwarna jingga?</p>
            <p className="text-sm text-text-muted">Fakta Unik · revisi 0 · dibuat Sari</p>
          </div>
          <ApprovalActions
            onDecide={async (d) => {
              await new Promise((r) => setTimeout(r, 700));
              toast({ title: { approve: "Naskah disetujui", revise: "Revisi dikirim ke Sari", reject: "Naskah ditolak" }[d], tone: "success" });
            }}
          />
          <ApprovalActions onDecide={() => {}} decided={{ decision: "approve", at: "09.41" }} />
        </Card>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Render video · 45%</p>
            <ProgressBar value={45} label="Render video" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">Anggaran AI bulan ini · $8,50 dari $10</p>
            <ProgressBar value={8.5} max={10} variant="meter" label="Anggaran AI terpakai" />
          </div>
        </div>
      </Section>

      <Section id="perangkat" title="Perangkat">
        <div className="grid gap-4 md:grid-cols-2">
          <DeviceCard kind="pc" name="PC Studio" status="online" lastSeen="baru saja" capabilities={["Menjalankan semua agent", "Membuat video", "Posting terjadwal"]} />
          <DeviceCard kind="vps" status="not_installed" onCreateCode={() => toast({ title: "Kode setup dibuat", tone: "success" })} />
        </div>
        <SetupCode code="K7Q2M9XA" expiresIn="58 menit lagi" />
      </Section>

      <Section id="cs" title="Chat CS">
        <Card className="max-w-xl">
          <ChatThread
            label="Percakapan dengan Rina"
            messages={[
              { id: "m1", from: "customer", text: "Kak, paket saya sudah dikirim belum ya?", time: "09.40" },
              { id: "m2", from: "agent", text: "Halo kak, sudah dikirim tadi pagi lewat JNE. Nomor resinya 0000 1111 2222.", time: "09.41", status: "read" },
              { id: "m3", from: "human", text: "Kalau sampai besok belum datang, kabari kami ya kak.", time: "09.45", status: "delivered" },
            ]}
          />
        </Card>
      </Section>

      <Section id="overlay" title="Dialog, menu, tab, toast">
        <Row label="Overlay">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Buka dialog</Button>
            </DialogTrigger>
            <DialogContent
              title="Cabut perangkat?"
              description="PC Studio tidak bisa lagi mengambil tugas. Tugas yang sedang jalan dikembalikan ke antrean."
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="secondary">Batal</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger">Cabut</Button>
                  </DialogClose>
                </>
              }
            />
          </Dialog>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary">
                <Settings aria-hidden />
                Menu
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem>Ubah</MenuItem>
              <MenuItem>Jalankan sekarang</MenuItem>
              <MenuItem danger>Arsipkan</MenuItem>
            </MenuContent>
          </Menu>
          <Button variant="secondary" onClick={() => toast({ title: "Tersimpan", description: "Perubahan agent disimpan.", tone: "success" })}>
            Toast sukses
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: "Gagal menyimpan", description: "Periksa koneksi lalu coba lagi.", tone: "error" })}>
            Toast error
          </Button>
        </Row>
        <Tabs defaultValue="profil">
          <TabsList label="Pengaturan agent">
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="skill">Skill</TabsTrigger>
            <TabsTrigger value="tugas">Tugas</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          </TabsList>
          <TabsContent value="profil" className="pt-4 text-sm text-text-2">Nama, jabatan, dan job desk.</TabsContent>
          <TabsContent value="skill" className="pt-4 text-sm text-text-2">Skill yang dipasang ke agent ini.</TabsContent>
          <TabsContent value="tugas" className="pt-4 text-sm text-text-2">Kapan agent bekerja.</TabsContent>
          <TabsContent value="riwayat" className="pt-4 text-sm text-text-2">Run terakhir beserta biaya.</TabsContent>
        </Tabs>
      </Section>

      <Section id="umpan-balik" title="Banner dan state kosong">
        <div className="flex flex-col gap-3">
          <Banner tone="warning" title="PC kamu offline" action={<Button size="sm" variant="secondary">Cara menyalakan</Button>}>
            3 tugas menunggu dan akan jalan begitu PC menyala lagi.
          </Banner>
          <Banner tone="info" title="Mode hemat aktif">
            Anggaran AI bulan ini sudah terpakai 85%. Tugas prioritas rendah dilewati.
          </Banner>
          <Banner tone="danger" title="Data pembayaran masih dummy">
            Ganti rekening dan nomor WhatsApp admin sebelum menerima pembeli asli.
          </Banner>
          <Banner tone="success" title="PC tersambung">
            Agent siap bekerja.
          </Banner>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card variant="flat">
            <EmptyState icon={<Inbox aria-hidden />} title="Tidak ada yang menunggu kamu" description="Naskah dan video yang perlu disetujui akan muncul di sini." />
          </Card>
          <Card variant="flat">
            <EmptyState
              icon={<Sparkles aria-hidden />}
              title="Belum ada agent"
              description="Mulai dengan satu periset dan satu penulis."
              action={<Button><Plus aria-hidden />Buat agent</Button>}
            />
          </Card>
        </div>
      </Section>

      <Section id="pemasaran" title="Pemasaran">
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]">
          <PricingCard
            plan="Kantoraiku lifetime"
            price={299000}
            note="Sekali bayar. Tanpa biaya bulanan."
            features={["Agent konten dan CS WhatsApp", "Alamat kantor sendiri di kantoraiku.id", "Konektor PC Windows, Mac menyusul", "Semua update berikutnya"]}
            cta={<Button size="lg">Mulai sekarang</Button>}
          />
          <Accordion
            items={[
              { q: "Apakah saya perlu bisa coding?", a: "Tidak. Asisten setup menuntun kamu langkah demi langkah." },
              { q: "Siapa yang membayar biaya AI?", a: "Kamu, langsung ke Anthropic atau OpenAI lewat API key milikmu. Kantoraiku tidak memungut biaya AI." },
              { q: "Bagaimana kalau PC saya mati?", a: "Tugas menunggu dan jalan lagi begitu PC menyala. Dashboard tetap bisa dibuka." },
            ]}
          />
        </div>
        <Row label="Template video (Fase 2)">
          <Button size="sm" variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? "Putar gerakan" : "Jeda gerakan"}
          </Button>
        </Row>
        <div className="-mx-(--k-gutter) flex gap-3 overflow-x-auto px-(--k-gutter) pb-2">
          {[
            ["kapur", "Papan Tulis"],
            ["peta", "Peta Lipat"],
            ["etalase", "Etalase"],
            ["tinta", "Goresan"],
            ["neon", "Garis Neon"],
          ].map(([k, n]) => (
            <TemplateCard key={k} name={n} paused={paused} selected={template === k} onSelect={() => setTemplate(k)} />
          ))}
        </div>
      </Section>

      <Section id="admin" title="Tabel admin">
        <DataTable<Order>
          caption="Pesanan terbaru"
          rows={ORDERS}
          rowKey={(r) => r.code}
          columns={[
            { key: "code", header: "Kode", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { key: "buyer", header: "Pembeli", cell: (r) => r.buyer },
            { key: "method", header: "Metode", cell: (r) => r.method },
            { key: "amount", header: "Nominal", cell: (r) => formatRupiah(r.amount) },
            { key: "status", header: "Status", cell: (r) => <StatusPill tone={r.status}>{r.statusLabel}</StatusPill> },
          ]}
        />
        <Button variant="ghost" className="self-start">
          <Bell aria-hidden />
          Kirim pengingat
        </Button>
      </Section>

      <FloatingWhatsApp phone="6280000000000" text="Halo, saya mau tanya soal Kantoraiku." />
    </main>
  );
}
