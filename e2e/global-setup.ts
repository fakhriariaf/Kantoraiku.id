import { randomBytes } from "node:crypto";
import { admin, sql } from "./helpers";

/**
 * Sekali per run: rate limit dikosongkan, admin e2e dibuat ulang dengan password acak
 * (dikirim ke worker lewat env; tidak ditulis ke file mana pun).
 */
export default async function globalSetup() {
  if (!/127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) {
    throw new Error("E2E hanya untuk Supabase lokal.");
  }
  await sql`delete from public.rate_limits`;
  const email = "e2e-admin@kantoraiku.test";
  const password = `e2e-${randomBytes(9).toString("base64url")}`;
  const [u] = await sql`select id from auth.users where email = ${email}`;
  let id = u?.id as string | undefined;
  if (id) {
    await admin.auth.admin.updateUserById(id, { password, app_metadata: { password_set: true } });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { password_set: true } });
    if (error) throw error;
    id = data.user.id;
  }
  await sql`insert into public.platform_admins (user_id) values (${id}) on conflict do nothing`;
  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;
  await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" }).catch(() => {});
}
