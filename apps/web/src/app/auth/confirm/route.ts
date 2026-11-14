import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { supabase } from "@/server/supabase";

const TYPES: EmailOtpType[] = ["recovery", "email", "magiclink"];

/**
 * Tukar token dari link email (reset password, link masuk) jadi sesi, lalu lanjut ke `next`.
 * Sesi lama di browser diganti; bila token gagal, tidak pernah lanjut ke `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next") ?? "/kantor-saya";
  // Hanya path di situs ini (cegah open redirect).
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/kantor-saya";

  let ok = false;
  if (tokenHash && type && TYPES.includes(type)) {
    const sb = await supabase();
    await sb.auth.signOut({ scope: "local" });
    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }
  redirect(ok ? next : "/masuk?e=link");
}
