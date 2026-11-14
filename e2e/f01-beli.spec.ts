import { adminLogin, createOffice, expect, expectA11y, sql, test, uid, visible } from "./helpers";

const field = (page: import("@playwright/test").Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true }).first();

test.describe("F01 beli kantor", () => {
  // Rate limit pesanan (5 per 10 menit per IP) juga berlaku untuk tes: kosongkan sebelum tiap kasus.
  test.beforeEach(async () => {
    await sql`delete from public.rate_limits`;
  });

  test("F01-H1/H2/H3 pesan -> admin tandai lunas -> pembeli atur password -> masuk kantor", async ({ page, browser }) => {
    const id = uid();
    const slug = `toko-${id}`;
    const email = `beli-${id}@contoh.test`;

    await page.goto("/beli");
    await expectA11y(page, "S03 /beli");
    await field(page, "Nama").fill("Ayu Sörensen 🌸"); // F01-E3: aksen + emoji
    await field(page, "Email").fill(email);
    await field(page, "Nomor WhatsApp").fill("0812-3456 7890");
    await field(page, "Alamat kantor").fill(slug);
    await page.getByRole("button", { name: "Buat pesanan" }).click();

    await expect(page).toHaveURL(/\/pesanan\/[\w-]+$/);
    await expect(page.getByRole("heading", { name: "Selesaikan pembayaran" })).toBeVisible();
    await expectA11y(page, "S05 menunggu bayar");
    const orderUrl = page.url();
    const [o] = await sql`select id, buyer_name, buyer_whatsapp, status from public.orders where office_slug = ${slug}`;
    expect(o.buyer_name).toBe("Ayu Sörensen 🌸");
    expect(o.buyer_whatsapp).toBe("081234567890");

    const ctx = await browser.newContext();
    const ap = await ctx.newPage();
    await adminLogin(ap);
    await expectA11y(ap, "A01 /admin");
    await ap.goto(`/admin/pesanan/${o.id}`);
    await expectA11y(ap, "A02 detail pesanan");
    await visible(ap, "button", "Tandai lunas").click();
    await ap.getByRole("button", { name: "Ya, tandai lunas" }).click();
    await expect(ap.getByText("Pembayaran dikonfirmasi, kantor sudah dibuat")).toBeVisible();
    await ctx.close();

    await page.goto(orderUrl);
    await expect(page.getByRole("heading", { name: "Kantor kamu sudah aktif" })).toBeVisible();
    await expect(page.getByText("Ayu Sörensen 🌸", { exact: false }).first()).toBeVisible();
    await visible(page, "button", "Atur password dan buka kantor").click();
    await expect(page).toHaveURL(/\/atur-password$/);
    await expect(page.getByText("Akun:").filter({ visible: true })).toContainText(email);
    await expectA11y(page, "atur password");
    await field(page, "Password baru").fill("uji-password-123");
    await field(page, "Ulangi password").fill("uji-password-123");
    await page.getByRole("button", { name: "Simpan dan buka kantor" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${slug}$`));
    await expectA11y(page, "S11 beranda kosong");

    // Tombol atur password kedua kali: password sudah ada -> ke halaman masuk, bukan reset diam-diam.
    await page.goto(orderUrl);
    await visible(page, "button", "Atur password dan buka kantor").click();
    await expect(page).toHaveURL(new RegExp(`/o/${slug}/masuk$`));
  });

  test("F01-E1 kosong: setiap kolom wajib diberi pesan", async ({ page }) => {
    await page.goto("/beli");
    await page.getByRole("button", { name: "Buat pesanan" }).click();
    await expect(page.getByText("Isi nama kamu.")).toBeVisible();
    await expect(page.getByText("Format email belum benar.")).toBeVisible();
    await expect(page.getByText(/Nomor WhatsApp belum benar/)).toBeVisible();
  });

  test("F01-E2 nama sangat panjang: pesan berbahasa Indonesia, tidak crash", async ({ page }) => {
    await page.goto("/beli");
    await field(page, "Nama").fill("A".repeat(200));
    await field(page, "Email").fill(`panjang-${uid()}@contoh.test`);
    await field(page, "Nomor WhatsApp").fill("081234567890");
    await field(page, "Alamat kantor").fill(`pj-${uid()}`);
    await page.getByRole("button", { name: "Buat pesanan" }).click();
    await expect(field(page, "Nama")).toHaveAttribute("aria-invalid", "true");
    const err = page.locator("#" + (await field(page, "Nama").getAttribute("aria-describedby"))!.split(" ")[0]);
    await expect(err).toHaveText("Nama maksimal 120 karakter.");
  });

  test("F01-E4 alamat sistem ditolak", async ({ page }) => {
    await page.goto("/beli");
    await field(page, "Alamat kantor").fill("admin");
    await field(page, "Alamat kantor").blur();
    await expect(page.getByText("Alamat ini dipakai sistem. Pilih yang lain.")).toBeVisible();
  });

  test("F01-E5 dua tab memesan alamat yang sama: tab kedua ditolak", async ({ page, browser }) => {
    const slug = `dua-${uid()}`;
    const fill = async (p: typeof page, email: string) => {
      await p.goto("/beli");
      await field(p, "Nama").fill("Pembeli Uji");
      await field(p, "Email").fill(email);
      await field(p, "Nomor WhatsApp").fill("081234567890");
      await field(p, "Alamat kantor").fill(slug);
    };
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await fill(page, `a-${uid()}@contoh.test`);
    await fill(p2, `b-${uid()}@contoh.test`);
    await page.getByRole("button", { name: "Buat pesanan" }).click();
    await expect(page).toHaveURL(/\/pesanan\//);
    await p2.getByRole("button", { name: "Buat pesanan" }).click();
    await expect(p2.getByText(/sudah dipakai|baru saja dipesan/)).toBeVisible();
    await ctx.close();
    const [{ n }] = await sql`select count(*)::int as n from public.orders where office_slug = ${slug}`;
    expect(n).toBe(1);
  });

  test("F01-E6 klik dobel 'Buat pesanan' membuat satu pesanan", async ({ page }) => {
    const slug = `dobel-${uid()}`;
    await page.goto("/beli");
    await field(page, "Nama").fill("Klik Dobel");
    await field(page, "Email").fill(`dobel-${uid()}@contoh.test`);
    await field(page, "Nomor WhatsApp").fill("081234567890");
    await field(page, "Alamat kantor").fill(slug);
    await page.getByRole("button", { name: "Buat pesanan" }).dblclick();
    await expect(page).toHaveURL(/\/pesanan\//);
    const [{ n }] = await sql`select count(*)::int as n from public.orders where office_slug = ${slug}`;
    expect(n).toBe(1);
  });

  test("F01-E8 lebar HP 390px: tanpa scroll horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/beli");
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expectA11y(page, "S03 /beli HP");
  });

  test("F01-E9 hanya keyboard: isi dan kirim formulir", async ({ page }) => {
    const slug = `kb-${uid()}`;
    await page.goto("/beli");
    await field(page, "Nama").focus();
    await page.keyboard.type("Pengguna Keyboard");
    await page.keyboard.press("Tab");
    await page.keyboard.type(`kb-${uid()}@contoh.test`);
    await page.keyboard.press("Tab");
    await page.keyboard.type("081234567890");
    await page.keyboard.press("Tab");
    await page.keyboard.type(slug);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/pesanan\//);
  });

  test("F01-N1 token pesanan tidak dikenal -> 404", async ({ page }) => {
    await page.goto(`/pesanan/tidak-ada-${uid()}`);
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
  });

  test("F01-N2 bukan admin tidak bisa masuk panel admin", async ({ page }) => {
    const f = await createOffice();
    await page.goto("/admin/masuk");
    await field(page, "Email").fill(f.email);
    await field(page, "Password").fill(f.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page.getByText("Akun ini bukan admin.")).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/masuk/);
  });

  test("F01-N3 pesanan kedaluwarsa: halaman berubah dan alamat bebas lagi", async ({ page }) => {
    const slug = `exp-${uid()}`;
    const token = `t${uid()}${"x".repeat(32)}`;
    await sql`insert into public.orders (code, public_token, buyer_name, buyer_email, buyer_whatsapp, office_slug, amount, payment_method, expires_at)
              values (${"KTR-E2E-" + uid().toUpperCase()}, ${token}, 'Lewat Waktu', ${`exp-${uid()}@contoh.test`}, '081234567890', ${slug}, 299000, 'manual', now() - interval '1 minute')`;
    await sql`select public.expire_pending_orders()`;
    await page.goto(`/pesanan/${token}`);
    await expect(page.getByText("Batas waktu pembayaran lewat")).toBeVisible();
    await page.goto("/beli");
    await field(page, "Alamat kantor").fill(slug);
    await field(page, "Alamat kantor").blur();
    await expect(page.getByText(`${slug}.kantoraiku.id tersedia`)).toBeVisible();
  });
});
