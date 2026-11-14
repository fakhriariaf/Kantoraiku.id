import { createOffice, expect, expectA11y, login, mailLink, sql, test, uid } from "./helpers";

const field = (page: import("@playwright/test").Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true }).first();
// Next menambahkan pengumum rute (role=alert, kosong); ambil alert form yang berisi teks.
const formAlert = (page: import("@playwright/test").Page) => page.getByRole("alert").filter({ hasText: /\S/ }).first();

test.describe("F11 masuk", () => {
  test.beforeEach(async () => {
    await sql`delete from public.rate_limits`;
  });

  test("F11-H1 login dengan password, lalu keluar (F11-E1)", async ({ page }) => {
    const f = await createOffice();
    await page.goto(`/o/${f.slug}/masuk`);
    await expectA11y(page, "S10 login kantor");
    await login(page, f);
    await page.getByRole("button", { name: "Keluar" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/masuk$`));
    await page.goto(`/o/${f.slug}/agent`);
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/masuk$`));
  });

  test("F11-N1 password salah", async ({ page }) => {
    const f = await createOffice();
    await page.goto(`/o/${f.slug}/masuk`);
    await field(page, "Email").fill(f.email);
    await field(page, "Password").fill("salah-sekali-123");
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(formAlert(page)).toHaveText("Email atau password salah.");
  });

  test("F11-N2 akun kantor lain tidak bisa masuk ke kantor ini", async ({ page }) => {
    const a = await createOffice();
    const b = await createOffice();
    await page.goto(`/o/${a.slug}/masuk`);
    await field(page, "Email").fill(b.email);
    await field(page, "Password").fill(b.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(formAlert(page)).toHaveText("Akun ini tidak terdaftar di kantor ini.");
  });

  test("F11-H2 link masuk lewat email -> kantor", async ({ page }) => {
    const f = await createOffice();
    await page.goto("/masuk");
    await expectA11y(page, "S06 /masuk");
    await field(page, "Email").fill(f.email);
    await page.getByRole("button", { name: "Kirim link masuk" }).click();
    await expect(page.getByText("Cek email kamu")).toBeVisible();
    const link = await mailLink(f.email, /Link masuk/);
    await page.goto(link);
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}$`));
  });

  test("F11-H3 lupa password lewat email; F11-N3 link dipakai ulang ditolak", async ({ page }) => {
    const f = await createOffice();
    await page.goto("/lupa-password");
    await expectA11y(page, "S07 lupa password");
    await field(page, "Email").fill(f.email);
    await page.getByRole("button", { name: "Kirim link atur password" }).click();
    await expect(page.getByText("Cek email kamu")).toBeVisible();
    const link = await mailLink(f.email, /Atur password/);
    await page.goto(link);
    await expect(page).toHaveURL(/\/atur-password$/);
    await expect(page.getByText("Akun:").filter({ visible: true })).toContainText(f.email);
    await field(page, "Password baru").fill("password-baru-123");
    await field(page, "Ulangi password").fill("password-baru-123");
    await page.getByRole("button", { name: "Simpan dan buka kantor" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}$`));
    // password baru berlaku
    await page.context().clearCookies();
    await login(page, { ...f, password: "password-baru-123" });
    // link lama ditolak
    await page.goto(link);
    await expect(page).toHaveURL(/\/masuk\?e=link$/);
    await expect(page.getByText("Link sudah dipakai atau kedaluwarsa").filter({ visible: true })).toBeVisible();
  });

  test("F11-N4 email tidak terdaftar mendapat jawaban yang sama (anti-enumerasi)", async ({ page }) => {
    const email = `tidak-ada-${uid()}@contoh.test`;
    await page.goto("/masuk");
    await field(page, "Email").fill(email);
    await page.getByRole("button", { name: "Kirim link masuk" }).click();
    await expect(page.getByText("Cek email kamu")).toBeVisible();
  });

  test("F11-N5 batas percobaan login: ke-11 dalam 10 menit ditolak", async ({ page }) => {
    const f = await createOffice();
    await page.goto(`/o/${f.slug}/masuk`);
    for (let i = 0; i < 11; i++) {
      await field(page, "Email").fill(f.email);
      await field(page, "Password").fill(`salah-${i}-xxxxxx`);
      // Tunggu tiap kiriman selesai (server action = POST ke halaman ini).
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes(`/o/${f.slug}/masuk`)),
        page.getByRole("button", { name: "Masuk" }).click(),
      ]);
    }
    await expect(formAlert(page)).toContainText("Terlalu banyak percobaan");
    await sql`delete from public.rate_limits`;
  });

  test("F11-E2 /auth/confirm tidak mengalihkan ke situs lain", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=abc&type=recovery&next=//contoh-jahat.test");
    await expect(page).toHaveURL(/localhost:3000\/masuk\?e=link$/);
  });
});
