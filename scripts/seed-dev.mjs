// Seed dev: admin platform dengan password acak. Tidak membuat data pelanggan (alur beli dipakai untuk itu).
// Pakai: pnpm seed  (membaca apps/web/.env.local)
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const postgres = (await import(pathToFileURL(require.resolve("postgres")).href)).default;

const env = process.env;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) if (!env[k]) throw new Error(`${k} kosong. Jalankan pnpm env:local dulu.`);
if (!/localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error("Seed dev hanya untuk Supabase lokal.");

const email = (env.DEV_ADMIN_EMAIL || "admin@kantoraiku.test").toLowerCase();
const password = env.DEV_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1 });

const [existing] = await sql`select id from auth.users where lower(email) = ${email}`;
let id = existing?.id;
if (id) {
  const { error } = await admin.auth.admin.updateUserById(id, { password, app_metadata: { password_set: true } });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { password_set: true } });
  if (error) throw error;
  id = data.user.id;
}
await sql`insert into public.platform_admins (user_id) values (${id}) on conflict do nothing`;
await sql.end();

if (!env.DEV_ADMIN_PASSWORD) {
  mkdirSync("apps/web/.data", { recursive: true });
  writeFileSync(
    "apps/web/.data/dev-credentials.txt",
    `Admin dev Kantoraiku (Supabase lokal saja)\nURL: http://localhost:3000/admin/masuk\nEmail: ${email}\nPassword: ${password}\n`,
  );
}
console.log(`Admin dev siap: ${email}. ${env.DEV_ADMIN_PASSWORD ? "" : "Password di apps/web/.data/dev-credentials.txt"}`);
