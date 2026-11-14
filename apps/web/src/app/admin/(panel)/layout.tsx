import { LogOut } from "lucide-react";
import { Logo } from "@/components/shell/public-header";
import { Chip } from "@/components/ui/chip";
import { adminLogout } from "../actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-header max-w-page items-center justify-between gap-3 px-(--k-gutter)">
          <div className="flex items-center gap-3">
            <Logo />
            <Chip variant="tag">admin</Chip>
          </div>
          <form action={adminLogout}>
            <button type="submit" className="inline-flex h-control-sm items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-text-2 hover:bg-surface-2">
              <LogOut aria-hidden className="size-4" />
              Keluar
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex max-w-page flex-col gap-6 px-(--k-gutter) py-8">{children}</main>
    </>
  );
}
