import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connector, createOffice, expect, expectA11y, login, setupCode, sql, test } from "./helpers";

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();
const SECRET = "sk-uji-rahasia-ABCDEF7890";

test.describe("S30 kunci & integrasi", () => {
  test("S30-H1 isi kunci: dienkripsi di browser, server hanya menyimpan ciphertext, PC memakainya", async ({ page }) => {
    const f = await createOffice();
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await login(page, f);

    // Kunci asli tidak boleh ada di request mana pun ke server.
    const leaked: string[] = [];
    page.on("request", (r) => {
      if ((r.postData() ?? "").includes(SECRET) || r.url().includes(SECRET)) leaked.push(r.url());
    });

    await page.goto(`/o/${f.slug}/kunci`);
    await expectA11y(page, "S30 kunci");
    await page.getByLabel("OpenAI", { exact: true }).filter({ visible: true }).first().fill(SECRET);
    await page.getByRole("button", { name: "Simpan untuk PC ini" }).filter({ visible: true }).first().click();
    await expect(text(page, "Kunci OpenAI tersimpan")).toBeVisible();
    await expect(text(page, "••••7890")).toBeVisible();
    expect(leaked).toEqual([]);

    const [row] = await sql`select ciphertext, hint from public.device_secrets where office_id = ${f.officeId} and kind = 'openai_api_key'`;
    expect(row.ciphertext).toMatch(/^v1\./);
    expect(row.ciphertext).not.toContain(SECRET);
    expect(row.hint).toBe("7890");

    const out = await c.runOnce();
    expect(out.stdout).toContain("Kunci dari dashboard terpasang: 1 dari 1");
    const [dev] = await sql`select ai_status from public.devices where office_id = ${f.officeId}`;
    expect(dev.ai_status.openai).toBe("ok");
    await page.goto(`/o/${f.slug}/perangkat`);
    await expect(text(page, "OpenAI: siap")).toBeVisible();
  });

  test("S30-H2 hapus kunci: PC kembali tanpa kunci", async ({ page }) => {
    const f = await createOffice();
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await login(page, f);
    await page.goto(`/o/${f.slug}/kunci`);
    await page.getByLabel("Pexels", { exact: true }).filter({ visible: true }).first().fill("pexels-kunci-uji-1234");
    await page.getByRole("button", { name: "Simpan untuk PC ini" }).filter({ visible: true }).nth(4).click(); // Pexels: baris ke-5 (OpenAI, Claude, ElevenLabs, fal, Pexels)
    await expect(text(page, "Kunci Pexels tersimpan")).toBeVisible();

    await page.getByRole("button", { name: "Hapus kunci Pexels" }).filter({ visible: true }).first().click();
    await expect(text(page, "Kunci Pexels dihapus dari PC ini")).toBeVisible();
    const rows = await sql`select 1 from public.device_secrets where office_id = ${f.officeId}`;
    expect(rows.length).toBe(0);
  });

  test("S30-N1 perangkat hanya menerima kuncinya sendiri; kunci pendek ditolak di browser", async ({ page }) => {
    const a = await createOffice();
    const ca = connector();
    await ca.pair(await setupCode(a.officeId));
    const b = await createOffice();
    const cb = connector();
    await cb.pair(await setupCode(b.officeId));
    const [devA] = await sql`select id from public.devices where office_id = ${a.officeId}`;
    await sql`insert into public.device_secrets (office_id, device_id, kind, ciphertext, hint) values (${a.officeId}, ${devA.id}, 'openai_api_key', 'v1.AAAA.AAAA.AAAA', 'AAAA')`;

    const tokenB = JSON.parse(readFileSync(join(cb.dir, "connector.json"), "utf8")).deviceToken;
    const res = await page.request.post("/api/device/secrets", { headers: { authorization: `Bearer ${tokenB}` }, data: {} });
    expect(res.ok()).toBe(true);
    expect((await res.json()).secrets).toEqual([]);
    expect((await page.request.post("/api/device/secrets", { data: {} })).status()).toBe(401);

    await login(page, b);
    await page.goto(`/o/${b.slug}/kunci`);
    await page.getByLabel("ElevenLabs", { exact: true }).filter({ visible: true }).first().fill("pendek");
    await page.getByRole("button", { name: "Simpan untuk PC ini" }).filter({ visible: true }).nth(2).click();
    await expect(text(page, /Kunci terlalu pendek/)).toBeVisible();
  });

  test("S30-E1 belum ada PC: ajakan pasang PC; HP 390px tanpa scroll horizontal", async ({ page }) => {
    const f = await createOffice();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    await page.goto(`/o/${f.slug}/kunci`);
    await expect(text(page, "Belum ada PC terpasang")).toBeVisible();
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await page.reload();
    await expect(page.getByLabel("OpenAI", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectA11y(page, "S30 390px");
  });
});
