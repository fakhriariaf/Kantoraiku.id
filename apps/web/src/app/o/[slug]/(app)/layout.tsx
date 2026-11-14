import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Skeleton } from "@/components/ui/feedback";
import { requireMember } from "@/server/auth";

type P = { children: React.ReactNode; params: Promise<{ slug: string }> };

// Dashboard selalu di balik login dan navigasinya bergantung pada slug: boleh memblokir
// (tidak ada static shell yang berguna untuk tamu). Halaman di bawahnya tetap divalidasi.
export const instant = false;

async function OfficeName({ params }: { params: Promise<{ slug: string }> }) {
  const { office } = await requireMember((await params).slug);
  return office.display_name;
}

// Layout statis: data kantor masuk lewat slot ber-Suspense. Setiap halaman tetap memanggil requireMember sendiri.
export default function OfficeLayout({ children, params }: P) {
  return (
    <AppShell
      officeName={
        <Suspense fallback={<Skeleton className="h-5 w-32" />}>
          <OfficeName params={params} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
