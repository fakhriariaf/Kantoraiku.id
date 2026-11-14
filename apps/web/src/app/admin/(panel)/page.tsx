import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { Banner, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { orderStatus } from "./order-status";
import { DataTable } from "@/components/ui/data-table";
import { requireAdmin } from "@/server/auth";
import { isDummyPaymentConfig } from "@/server/config";
import { listOrders, type OrderRow } from "@/server/orders";
import { dateTime, rupiah } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Pesanan · Admin Kantoraiku", robots: { index: false } };

const FILTERS = [
  { key: "pending", label: "Menunggu" },
  { key: "paid", label: "Lunas" },
  { key: "semua", label: "Semua" },
];

export default function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return (
    <>
      <h1 className="text-2xl">Pesanan</h1>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "pending" } = await searchParams;
  const rows = await listOrders(status === "semua" ? undefined : status);

  return (
    <>
      {isDummyPaymentConfig() && (
        <Banner tone="danger" title="Data pembayaran masih dummy">
          Isi MANUAL_BANK_* dan ADMIN_WHATSAPP di env sebelum menerima pembeli asli.
        </Banner>
      )}
      <nav aria-label="Filter status" className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin?status=${f.key}`}
            aria-current={status === f.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold",
              status === f.key ? "border-accent text-text" : "border-transparent text-text-muted hover:text-text",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <Card variant="flat">
          <EmptyState icon={<Inbox aria-hidden />} title="Tidak ada pesanan" description="Pesanan dengan status ini akan muncul di sini." />
        </Card>
      ) : (
        <DataTable<OrderRow>
          caption="Daftar pesanan"
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "code",
              header: "Kode",
              cell: (r) => (
                <Link href={`/admin/pesanan/${r.id}`} className="font-mono text-xs font-semibold text-accent underline-offset-4 hover:underline">
                  {r.code}
                </Link>
              ),
            },
            { key: "buyer", header: "Pembeli", cell: (r) => <span className="break-all">{r.buyer_name}</span> },
            { key: "slug", header: "Alamat", cell: (r) => <span className="font-mono text-xs">{r.office_slug}</span> },
            { key: "amount", header: "Nominal", cell: (r) => rupiah(Number(r.amount)) },
            { key: "created", header: "Dibuat", cell: (r) => dateTime(r.created_at) },
            { key: "status", header: "Status", cell: (r) => <StatusPill tone={orderStatus[r.status].tone}>{orderStatus[r.status].label}</StatusPill> },
          ]}
        />
      )}
    </>
  );
}
