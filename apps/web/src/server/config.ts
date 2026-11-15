import "server-only";
import { subdomainsEnabled } from "@/lib/office-host";

/**
 * Konfigurasi bisnis (replica/architecture.md > Konfigurasi bisnis).
 * Nilai default adalah DUMMY. Ganti di env sebelum production;
 * isDummyPaymentConfig() dipakai untuk peringatan di panel admin dan preflight deploy.
 */
export const config = {
  appDomain: process.env.APP_DOMAIN ?? "localhost:3000",
  priceLifetimeIdr: Number(process.env.PRICE_LIFETIME_IDR ?? 299000),
  manualBankName: process.env.MANUAL_BANK_NAME ?? "BANK DUMMY",
  manualBankAccount: process.env.MANUAL_BANK_ACCOUNT ?? "0000000000",
  manualBankHolder: process.env.MANUAL_BANK_HOLDER ?? "NAMA PEMILIK (DUMMY)",
  adminWhatsapp: process.env.ADMIN_WHATSAPP ?? "6280000000000",
  manualPaymentHours: Number(process.env.MANUAL_PAYMENT_HOURS ?? 72),
  /** Alamat email support di footer dan dokumen legal. Kotak suratnya harus dibuat sendiri. */
  supportEmail: process.env.SUPPORT_EMAIL ?? `support@${process.env.PUBLIC_DOMAIN ?? "kantoraiku.id"}`,
  /** Nama pemilik atau badan usaha pengelola, untuk dokumen legal. Kosong = belum diisi. */
  legalEntity: process.env.LEGAL_ENTITY ?? "",
  /** Installer konektor Windows (apps/connector). Default: rilis terbaru di GitHub Releases. */
  connectorWindowsUrl:
    process.env.CONNECTOR_WINDOWS_URL || "https://github.com/fakhriariaf/Kantoraiku.id/releases/latest/download/Kantoraiku-Setup.exe",
};

/** Nomor WhatsApp admin masih dummy: jangan tampilkan sebagai kontak publik. */
export function hasRealWhatsapp() {
  return config.adminWhatsapp !== "6280000000000";
}

export function isDummyPaymentConfig() {
  return (
    config.manualBankAccount === "0000000000" ||
    config.manualBankHolder.includes("DUMMY") ||
    config.adminWhatsapp === "6280000000000"
  );
}

/** Domain yang ditampilkan ke pembeli (suffix alamat kantor). */
export function publicDomain() {
  return process.env.PUBLIC_DOMAIN ?? "kantoraiku.id";
}

/**
 * URL kantor (opsional dengan path di dalam kantor, mis. "/masuk").
 * Production (atau dev dengan OFFICE_SUBDOMAINS=1): subdomain {slug}.{APP_DOMAIN}; selain itu path /o/{slug}.
 */
export function officeUrl(slug: string, path = "") {
  if (!subdomainsEnabled()) return `/o/${slug}${path}`;
  const local = config.appDomain.startsWith("localhost") || config.appDomain.includes(".localhost");
  return `${local ? "http" : "https"}://${slug}.${config.appDomain}${path || "/"}`;
}
