import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const run = promisify(execFile);

export const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });
export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const uid = () => `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;

/**
 * Setiap tes otomatis gagal bila ada console error atau respons 5xx.
 * `allowConsole` untuk pesan yang memang diharapkan (mis. jaringan offline).
 */
export const test = base.extend<{ guard: { allowConsole: RegExp[] } }>({
  guard: [
    async ({ page }, use) => {
      await sql`delete from public.rate_limits`;
      const errors: string[] = [];
      const guard = { allowConsole: [] as RegExp[] };
      page.on("console", (m) => {
        if (m.type() === "error" && !guard.allowConsole.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`);
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
      });
      await use(guard);
      expect(errors, "console error / 5xx selama tes").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/** Pindai aksesibilitas (WCAG 2 A/AA). */
export async function expectA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const v = r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.length} elemen, contoh ${x.nodes[0]?.target.join(" ")}`);
  expect(v, `pelanggaran aksesibilitas di ${label}`).toEqual([]);
}

export type OfficeFixture = { slug: string; email: string; password: string; officeId: string; userId: string };

/** Kantor + pemilik siap login (setara hasil "tandai lunas" + atur password). */
export async function createOffice(opts: { slug?: string; email?: string } = {}): Promise<OfficeFixture> {
  const id = uid();
  const slug = opts.slug ?? `e2e-${id}`;
  const email = opts.email ?? `pemilik-${id}@contoh.test`;
  const password = `uji-${randomBytes(8).toString("base64url")}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { password_set: true } });
  if (error) throw error;
  const [o] = await sql`insert into public.offices (slug, display_name) values (${slug}, ${"Kantor " + id}) returning id`;
  await sql`insert into public.office_members (office_id, user_id, role) values (${o.id}, ${data.user.id}, 'owner')`;
  await sql`insert into public.agents (office_id, name, title, kind, brain) values (${o.id}, 'Asisten', 'Asisten setup', 'assistant', 'simulation')`;
  return { slug, email, password, officeId: o.id, userId: data.user.id };
}

export type ContentSetup = { channelId: string; researcherId: string; writerId: string; researchTaskId: string; scriptTaskId: string };

/** Channel + periset + penulis (simulasi) + tugas riset (manual) -> tugas naskah (setelah riset). */
export async function addContentSetup(officeId: string, mode: "manual" | "auto" = "manual", brain = "simulation"): Promise<ContentSetup> {
  const [ch] = await sql`insert into public.channels (office_id, name, niche, mode) values (${officeId}, 'Fakta Uji', 'Fakta singkat untuk uji otomatis.', ${mode}) returning id`;
  const [a1] = await sql`insert into public.agents (office_id, name, title, brain) values (${officeId}, 'Periset Uji', 'Periset', ${brain}) returning id`;
  const [a2] = await sql`insert into public.agents (office_id, name, title, brain) values (${officeId}, 'Penulis Uji', 'Penulis naskah', 'simulation') returning id`;
  const [t1] = await sql`insert into public.tasks (office_id, agent_id, channel_id, name, kind, trigger) values (${officeId}, ${a1.id}, ${ch.id}, 'Riset uji', 'research', 'manual') returning id`;
  const [t2] = await sql`insert into public.tasks (office_id, agent_id, channel_id, name, kind, trigger, after_task_id) values (${officeId}, ${a2.id}, ${ch.id}, 'Naskah uji', 'script', 'after_task', ${t1.id}) returning id`;
  return { channelId: ch.id, researcherId: a1.id, writerId: a2.id, researchTaskId: t1.id, scriptTaskId: t2.id };
}

export async function queueRun(officeId: string, taskId: string) {
  const [r] = await sql`insert into public.task_runs (office_id, task_id, agent_id, channel_id, trigger_source)
    select office_id, id, agent_id, channel_id, 'manual' from public.tasks where id = ${taskId} and office_id = ${officeId} returning id`;
  return r.id as string;
}

/** Kode setup sekali pakai, ditulis langsung (UI-nya diuji terpisah di F02). */
export async function setupCode(officeId: string) {
  const code = randomBytes(6).toString("hex").toUpperCase().slice(0, 8);
  const { createHash } = await import("node:crypto");
  await sql`insert into public.setup_codes (office_id, code_hash, expires_at) values (${officeId}, ${createHash("sha256").update(code).digest("hex")}, now() + interval '1 hour')`;
  return code;
}

const RUNNER = resolve("packages/runner/src/cli.ts");

/** Konektor sungguhan (CLI) dengan folder konfigurasi sementara. */
export function connector() {
  const dir = mkdtempSync(join(tmpdir(), "kantoraiku-e2e-"));
  const env = { ...process.env, KANTORAIKU_CONFIG_DIR: dir, OPENAI_API_KEY: "" };
  const node = (args: string[]) => run(process.execPath, [RUNNER, ...args], { env, timeout: 90_000 });
  return {
    pair: (code: string, name = "PC E2E") => node(["pair", code, "--server", "http://localhost:3000", "--name", name]),
    runOnce: () => node(["start", "--once"]),
    dir,
  };
}

/** Login kantor lewat UI. */
export async function login(page: Page, f: Pick<OfficeFixture, "slug" | "email" | "password">) {
  await page.goto(`/o/${f.slug}/masuk`);
  await page.getByLabel("Email").fill(f.email);
  await page.getByLabel("Password").fill(f.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(new RegExp(`/o/${f.slug}$`));
}

export async function adminLogin(page: Page) {
  await page.goto("/admin/masuk");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Link pertama di email terbaru untuk alamat ini (Mailpit lokal). */
export async function mailLink(to: string, subject: RegExp) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await res.json()) as { messages: { ID: string; Subject: string }[] };
    const m = list.messages.find((x) => subject.test(x.Subject));
    if (m) {
      const full = (await (await fetch(`http://127.0.0.1:54324/api/v1/message/${m.ID}`)).json()) as { HTML: string };
      const href = full.HTML.match(/href="([^"]+)"/)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Email "${subject}" untuk ${to} tidak datang`);
}

/** Bar persetujuan / tombol: pilih yang terlihat (Next menyimpan salinan tersembunyi saat streaming). */
export const visible = (page: Page, role: Parameters<Page["getByRole"]>[0], name: string | RegExp) =>
  page.getByRole(role, { name }).filter({ visible: true }).first();
