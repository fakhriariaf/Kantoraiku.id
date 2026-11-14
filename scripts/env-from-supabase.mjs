// Tulis nilai Supabase LOKAL (dari `supabase status`) ke apps/web/.env.local.
// Nilai lain di .env.local dipertahankan. Untuk project cloud, isi .env.local sendiri.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const st = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const pick = (...keys) => keys.map((k) => st[k]).find(Boolean);
const vals = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
  DATABASE_URL: pick("DB_URL"),
};
for (const [k, v] of Object.entries(vals)) if (!v) throw new Error(`supabase status tidak berisi ${k}. Kunci yang ada: ${Object.keys(st).join(", ")}`);

const file = "apps/web/.env.local";
const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : readFileSync("apps/web/.env.example", "utf8").split(/\r?\n/);
const seen = new Set();
const out = lines.map((l) => {
  const k = l.split("=")[0];
  if (k in vals) { seen.add(k); return `${k}=${vals[k]}`; }
  return l;
});
for (const k of Object.keys(vals)) if (!seen.has(k)) out.push(`${k}=${vals[k]}`);
writeFileSync(file, out.join("\n"));
console.log(`${file} diperbarui dengan nilai Supabase lokal (${Object.keys(vals).join(", ")}).`);
