import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/shell/public-header";
import { LoginForm } from "@/components/shell/login-form";
import { adminLogin } from "../actions";

export const metadata: Metadata = { title: "Masuk admin · Kantoraiku", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-(--k-gutter) py-12">
      <Logo />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">Panel admin</h1>
        <p className="text-sm text-text-2">Khusus tim Kantoraiku.</p>
      </div>
      <Card>
        <LoginForm action={adminLogin} submitLabel="Masuk" />
      </Card>
    </main>
  );
}
