import { connector, createOffice, expect, expectA11y, login, setupCode, sql, test, visible } from "./helpers";

test.describe("F02 pasang PC", () => {
  test.beforeEach(async () => {
    await sql`delete from public.rate_limits`;
  });

  test("F02-H1 kode setup dari dashboard -> pair -> PC online", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    await expectA11y(page, "S29 perangkat kosong");
    await visible(page, "button", "Buat kode setup").click();
    const codeEl = page.locator('[aria-label^="Kode setup"]').filter({ visible: true }).first();
    await expect(codeEl).toBeVisible();
    const code = (await codeEl.textContent())!.replace(/\s/g, "");
    expect(code).toMatch(/^[A-Z0-9]{8}$/);

    const c = connector();
    const out = await c.pair(code, "PC Uji E2E");
    expect(out.stdout).toContain("Tersambung");
    await page.reload();
    await expect(page.getByRole("heading", { name: "PC Uji E2E" })).toBeVisible();
    await expect(page.getByText("Online").filter({ visible: true }).first()).toBeVisible();
    await expectA11y(page, "S29 perangkat terpasang");
  });

  test("F02-N1 kode salah; F02-N2 kode dipakai ulang; F02-N3 kode kedaluwarsa", async () => {
    const f = await createOffice();
    await expect(connector().pair("SALAH123")).rejects.toThrow(/Kode setup salah/);

    const code = await setupCode(f.officeId);
    await connector().pair(code);
    await expect(connector().pair(code)).rejects.toThrow(/Kode setup salah, sudah dipakai/);

    const old = await setupCode(f.officeId);
    await sql`update public.setup_codes set expires_at = now() - interval '1 minute' where office_id = ${f.officeId} and used_at is null`;
    await expect(connector().pair(old)).rejects.toThrow(/kedaluwarsa/);
  });

  test("F02-N4 slot PC penuh", async () => {
    const f = await createOffice();
    await connector().pair(await setupCode(f.officeId), "PC Pertama");
    await expect(connector().pair(await setupCode(f.officeId), "PC Kedua")).rejects.toThrow(/Slot PC kantor ini sudah penuh/);
  });

  test("F02-E1 cabut perangkat: konektor langsung ditolak", async ({ page }) => {
    const f = await createOffice();
    const c = connector();
    await c.pair(await setupCode(f.officeId), "PC Dicabut");
    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    await visible(page, "button", "Menu PC Dicabut").click();
    await page.getByRole("menuitem", { name: "Cabut perangkat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cabut" }).click();
    await expect(page.getByRole("heading", { name: "PC Dicabut" })).toHaveCount(0);
    const err = (await c.runOnce().catch((e) => e)) as { stdout?: string; code?: number };
    expect(err.code).toBe(1);
    expect(err.stdout).toContain("sudah dicabut dari kantor");
  });
});
