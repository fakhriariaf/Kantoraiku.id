import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Client Supabase untuk request ini (sesi dari cookie).
 * Cookie dipaksa httpOnly: dashboard tidak memakai client Supabase di browser.
 */
export async function supabase() {
  const store = await cookies();
  return createServerClient(url(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, { ...options, httpOnly: true }));
        } catch {
          // Dipanggil dari Server Component: cookie tidak bisa ditulis di sini; proxy.ts yang menyegarkan sesi.
        }
      },
    },
  });
}

/** Client admin (secret key): buat user, buat link reset. Hanya di server, jangan pernah ke browser. */
export function supabaseAdmin() {
  return createAdmin(url(), process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
