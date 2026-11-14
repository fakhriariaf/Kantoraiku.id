import { Check, MessageCircle } from "lucide-react";
import { Card, Eyebrow } from "@/components/ui/card";

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

export function PricingCard({
  plan,
  price,
  note,
  features,
  cta,
}: {
  plan: string;
  price: number;
  note: string;
  features: string[];
  cta: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-5 p-6 md:p-8">
      <div className="flex flex-col gap-2">
        <Eyebrow className="text-accent">{plan}</Eyebrow>
        <p className="text-2xl md:text-display">{formatRupiah(price)}</p>
        <p className="text-sm text-text-muted">{note}</p>
      </div>
      <ul className="flex flex-col gap-2.5 border-t border-border pt-5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-text-2">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            {f}
          </li>
        ))}
      </ul>
      {cta}
    </Card>
  );
}

/** Tombol WhatsApp melayang. Nomor dari env ADMIN_WHATSAPP (masih dummy). */
export function FloatingWhatsApp({ phone, text }: { phone: string; text?: string }) {
  const href = `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Tanya lewat WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center rounded-pill bg-accent text-on-accent shadow-pop transition-colors hover:bg-accent-hover"
    >
      <MessageCircle aria-hidden className="size-6" />
    </a>
  );
}
