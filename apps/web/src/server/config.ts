import "server-only";

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
};

export function isDummyPaymentConfig() {
  return (
    config.manualBankAccount === "0000000000" ||
    config.manualBankHolder.includes("DUMMY") ||
    config.adminWhatsapp === "6280000000000"
  );
}

/** URL kantor. Dev memakai path /o/{slug}; production memakai subdomain. */
export function officeUrl(slug: string) {
  return process.env.NODE_ENV === "production" ? `https://${slug}.${config.appDomain}` : `/o/${slug}`;
}
