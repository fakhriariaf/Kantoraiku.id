import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "@/components/shell/public-header";
import { resetAction } from "../masuk/actions";
import { EmailForm } from "../masuk/email-form";

export const metadata: Metadata = { title: "Lupa password · Kantoraiku" };

export default function ForgotPasswordPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-(--k-gutter) py-12">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl">Lupa password</h1>
          <p className="text-sm text-text-2">Kami kirim link untuk mengatur password baru ke email kamu.</p>
        </div>
        <Card>
          <EmailForm
            action={resetAction}
            submitLabel="Kirim link atur password"
            sentTitle="Cek email kamu"
            sentText="Kalau email ini terdaftar, link atur password sudah kami kirim. Link berlaku 1 jam."
          />
        </Card>
      </main>
    </>
  );
}
