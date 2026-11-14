import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routeHost, sessionCookieDomain, subdomainsEnabled } from "@/lib/office-host";

/**
 * 1. Subdomain kantor: {slug}.{APP_DOMAIN}/... dilayani oleh /o/{slug}/... (lihat lib/office-host.ts).
 * 2. Menyegarkan sesi Supabase di setiap request halaman (pola resmi @supabase/ssr untuk Next.js).
 * Route /api/device/* dan /api/webhooks/* dilewati: perangkat memakai Bearer token, webhook memakai tanda tangan.
 */
export async function proxy(request: NextRequest) {
  const route = routeHost({
    host: request.headers.get("host"),
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    appDomain: process.env.APP_DOMAIN ?? "localhost:3000",
    protocol: request.nextUrl.protocol,
    enabled: subdomainsEnabled(),
  });
  // Response biasa: NextResponse.redirect menjadikan URL ke host yang sama dengan request.url (localhost di dev)
  // relatif, sehingga pengalihan dari subdomain ke domain utama berputar di subdomain.
  if (route.type === "redirect") return new Response(null, { status: 307, headers: { location: route.url } });

  const make = () =>
    route.type === "rewrite" ? NextResponse.rewrite(new URL(route.path, request.url), { request }) : NextResponse.next({ request });
  let response = make();
  const domain = sessionCookieDomain();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: domain ? { domain } : undefined,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = make();
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, { ...options, httpOnly: true }));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // Wajib dipanggil sebelum respons dibuat supaya token yang diperbarui ikut tertulis.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/device|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
