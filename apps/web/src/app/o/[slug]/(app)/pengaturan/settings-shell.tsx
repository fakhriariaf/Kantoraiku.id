import { PageHeader } from "@/components/shell/page-header";
import { SettingsNav } from "./settings-nav";

/**
 * Kerangka Pengaturan: daftar bagian di kiri, isi bagian di kanan.
 * Halaman lama (Perangkat, Kunci, CS) tetap di URL-nya sendiri, hanya dikelompokkan di sini.
 */
export function SettingsShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title="Pengaturan" />
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_1fr] md:items-start md:gap-10">
        <div className="md:sticky md:top-24">
          <SettingsNav />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="text-xl">{title}</h2>
              {description && <p className="text-sm text-text-2">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
