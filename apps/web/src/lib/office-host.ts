// Subdomain per kantor: {slug}.{APP_DOMAIN} melayani halaman /o/{slug}/... (dipakai proxy.ts).
// Modul murni tanpa akses server, supaya mudah diuji.

const SLUG = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
/** Subdomain yang bukan kantor (juga ada di reserved_slugs, jadi tidak bisa dibeli). */
const NOT_OFFICE = new Set(["www"]);

/** Halaman situs utama: dibuka dari subdomain kantor -> dialihkan ke domain utama. */
const MAIN_ONLY = [
  "/beli",
  "/pesanan",
  "/admin",
  "/kantor-saya",
  "/lupa-password",
  "/atur-password",
  "/auth",
  "/syarat-ketentuan",
  "/kebijakan-privasi",
  "/kebijakan-refund",
  "/design",
];

/** Subdomain kantor aktif di production, atau di dev dengan OFFICE_SUBDOMAINS=1 (mis. studio.localhost:3000). */
export function subdomainsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.NODE_ENV === "production" || env.OFFICE_SUBDOMAINS === "1";
}

export function officeSlugFromHost(host: string | null, appDomain: string) {
  if (!host) return null;
  const h = host.toLowerCase();
  const d = appDomain.toLowerCase();
  if (!h.endsWith(`.${d}`)) return null;
  const sub = h.slice(0, -(d.length + 1));
  if (sub.includes(".") || NOT_OFFICE.has(sub) || !SLUG.test(sub)) return null;
  return sub;
}

export type HostRoute =
  | { type: "next" }
  | { type: "rewrite"; path: string }
  | { type: "redirect"; url: string };

/**
 * Keputusan routing untuk satu request.
 * - Di subdomain kantor: path bersih (/, /agent, /masuk) di-rewrite ke /o/{slug}/...; tautan internal /o/{slug}/... tetap jalan;
 *   /o/{kantor-lain}/... dialihkan ke subdomain kantor itu; halaman situs utama dialihkan ke domain utama.
 * - Di domain utama (bila subdomain aktif): /o/{slug}/... dialihkan ke subdomain kantornya.
 * Routing di host subdomain selalu aktif (juga di dev: studio.localhost:3000), karena hanya terjadi bila host itu dipakai.
 */
export function routeHost(opts: { host: string | null; pathname: string; search: string; appDomain: string; protocol: string; enabled: boolean }): HostRoute {
  const { pathname, search, appDomain, protocol } = opts;
  const officeUrl = (slug: string, path: string) => `${protocol}//${slug}.${appDomain}${path || "/"}${search}`;
  const slug = officeSlugFromHost(opts.host, appDomain);

  if (!slug) {
    // Domain utama: arahkan ke subdomain kantor hanya bila subdomain aktif (production / OFFICE_SUBDOMAINS=1).
    if (!opts.enabled) return { type: "next" };
    const m = /^\/o\/([^/]+)(\/.*)?$/.exec(pathname);
    if (m && SLUG.test(m[1])) return { type: "redirect", url: officeUrl(m[1], m[2] ?? "/") };
    return { type: "next" };
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) return { type: "next" };
  const own = /^\/o\/([^/]+)(\/.*)?$/.exec(pathname);
  if (own) return own[1] === slug ? { type: "next" } : { type: "redirect", url: officeUrl(own[1], own[2] ?? "/") };
  if (MAIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Hanya saat subdomain aktif: di dev server Next menjadikan Location ke localhost:3000 relatif (berputar).
    return opts.enabled ? { type: "redirect", url: `${protocol}//${appDomain}${pathname}${search}` } : { type: "next" };
  }
  return { type: "rewrite", path: `/o/${slug}${pathname === "/" ? "" : pathname}` };
}

/** Domain cookie sesi: domain induk di production supaya login di kantoraiku.id ikut ke semua subdomain kantor. */
export function sessionCookieDomain(env: Record<string, string | undefined> = process.env) {
  const d = env.APP_DOMAIN;
  if (env.NODE_ENV !== "production" || !d || d.includes(":") || d.startsWith("localhost")) return undefined;
  return `.${d}`;
}
