import Link from "next/link";
import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { SectionTitle } from "@/components/shell/page-header";
import { requireMember } from "@/server/auth";
import { officeLogout } from "../../../actions";
import { SettingsShell } from "../settings-shell";
import { LogoutEverywhereButton, PasswordForm } from "../forms";

type P = { params: Promise<{ slug: string }> };

export default function AccountPage({ params }: P) {
  return (
    <SettingsShell title="Akun" description="Password untuk masuk ke kantor, dan keluar dari browser.">
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Account params={params} />
      </Suspense>
    </SettingsShell>
  );
}

async function Account({ params }: P) {
  const { slug } = await params;
  const { user } = await requireMember(slug);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <SectionTitle>Masuk sebagai</SectionTitle>
        <p className="text-sm font-semibold break-all text-text">{user.email}</p>
        <div className="flex flex-wrap gap-2">
          <form action={officeLogout.bind(null, slug)}>
            <Button type="submit" variant="secondary">
              <LogOut aria-hidden />
              Keluar
            </Button>
          </form>
          <LogoutEverywhereButton slug={slug} />
        </div>
        <p className="text-xs text-text-muted">
          Keluar hanya berlaku di browser ini. Pakai &quot;Keluar dari semua perangkat&quot; bila kamu pernah masuk di HP atau komputer orang lain.
        </p>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <SectionTitle>Ganti password</SectionTitle>
        <PasswordForm slug={slug} />
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-6">
        <SectionTitle>Lupa password?</SectionTitle>
        <p className="text-sm text-text-2">
          Minta tautan atur ulang ke email kamu; tautannya berlaku 1 jam.{" "}
          <Link href="/lupa-password" className="font-semibold text-accent underline underline-offset-2">
            Buka halaman lupa password
          </Link>
        </p>
      </section>
    </div>
  );
}
