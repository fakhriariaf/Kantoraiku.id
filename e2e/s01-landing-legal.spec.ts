import { expect, expectA11y, test, visible } from "./helpers";

const legal = [
  { path: "/syarat-ketentuan", title: "Syarat & Ketentuan" },
  { path: "/kebijakan-privasi", title: "Kebijakan Privasi" },
  { path: "/kebijakan-refund", title: "Kebijakan Refund" },
];

test.describe("S01 landing", () => {
  test("S01-H1 hero, harga, dan tombol utama menuju halaman beli", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tim konten AI yang bekerja dari PC kamu.");
    await expectA11y(page, "S01 landing");

    // Harga dari config, bukan teks tetap.
    const harga = page.locator("#harga");
    await expect(harga.getByText(/Rp\s?299\.000/)).toBeVisible();

    await page.getByRole("link", { name: "Buat kantor" }).first().click();
    await expect(page).toHaveURL(/\/beli$/);
    await expect(visible(page, "heading", "Buat kantor kamu")).toBeVisible();
  });

  test("S01-H2 tanya jawab bisa dibuka dengan keyboard", async ({ page }) => {
    await page.goto("/#faq");
    const q = page.getByRole("button", { name: "Di mana API key saya disimpan?" });
    await q.focus();
    await page.keyboard.press("Enter");
    await expect(q).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("Di PC kamu, di konfigurasi konektor.", { exact: false })).toBeVisible();
    await expectA11y(page, "S01 FAQ terbuka");
  });

  test("S01-H3 contoh alur: mode Otomatis melewati persetujuan", async ({ page }) => {
    await page.goto("/#cara-kerja");
    const steps = page.getByRole("list", { name: "Contoh tahap satu konten" });
    await expect(steps.getByText("menunggu kamu")).toBeVisible();
    await page.getByRole("radio", { name: "Otomatis" }).click();
    await expect(steps.getByText("otomatis", { exact: true })).toBeVisible();
    await expect(page.getByText(/Naskah langsung dianggap disetujui/)).toBeVisible();
  });

  test("S01-E1 lebar HP 390px: tanpa scroll horizontal, axe lulus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expectA11y(page, "S01 landing 390px");
  });

  test("S01-E2 fitur yang belum dibangun ditandai Segera, kontak dummy tidak tampil", async ({ page }) => {
    await page.goto("/");
    const segera = page.locator("#segera");
    for (const t of ["Video dari naskah", "Posting terjadwal", "CS WhatsApp"]) {
      await expect(segera.getByRole("heading", { name: t })).toBeVisible();
    }
    await expect(segera.getByText("Segera")).toHaveCount(3);
    // Nomor WhatsApp admin masih dummy: tidak boleh muncul sebagai kontak publik.
    await expect(page.getByRole("link", { name: "Tanya lewat WhatsApp" })).toHaveCount(0);
    await expect(page.locator('a[href*="wa.me/6280000000000"]')).toHaveCount(0);
  });
});

test.describe("S09 legal", () => {
  for (const doc of legal) {
    test(`S09 ${doc.title}: terbuka dari footer landing, bertanda draf, axe lulus`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("contentinfo").getByRole("link", { name: doc.title }).click();
      await expect(page).toHaveURL(new RegExp(`${doc.path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(doc.title);
      await expect(page.getByRole("note")).toContainText("Draf");
      await expect(page.getByRole("navigation", { name: "Dokumen legal" }).getByRole("link", { name: doc.title })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expectA11y(page, `S09 ${doc.title}`);
    });
  }

  test("S09-E1 form beli menautkan S&K dan Kebijakan Privasi", async ({ page }) => {
    await page.goto("/beli");
    const form = page.locator("form").filter({ visible: true }).first();
    await form.getByRole("link", { name: "Kebijakan Privasi" }).click();
    await expect(page).toHaveURL(/\/kebijakan-privasi$/);
    await expect(page.getByRole("heading", { name: "5. Pihak yang ikut memproses data" })).toBeVisible();
  });
});
