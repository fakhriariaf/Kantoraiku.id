import { addContentSetup, createOffice, expect, expectA11y, login, sql, test } from "./helpers";

type Page = import("@playwright/test").Page;

/** Kantor dengan konten di berbagai keadaan + satu laporan dan satu tugas gagal. */
async function officeWithContents() {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId);
  const [ch2] = await sql`insert into public.channels (office_id, name, niche) values (${f.officeId}, 'Profesi Unik', 'Profesi langka.') returning id`;
  const add = async (channel: string, title: string, stage: string, failure: string | null = null) => {
    const [c] = await sql`insert into public.contents (office_id, channel_id, title, script, stage, failure_reason)
      values (${f.officeId}, ${channel}, ${title}, ${"Naskah " + title}, ${stage}, ${failure}) returning id`;
    return c.id as string;
  };
  const waiting = await add(s.channelId, "Kenapa laut asin", "script_review");
  await sql`insert into public.approvals (office_id, content_id, stage, revision) values (${f.officeId}, ${waiting}, 'script', 0)`;
  const waiting2 = await add(ch2.id, "Sehari jadi penjaga mercusuar", "script_review");
  await sql`insert into public.approvals (office_id, content_id, stage, revision) values (${f.officeId}, ${waiting2}, 'script', 0)`;
  const videoFailed = await add(ch2.id, "Pencicip kopi", "script_approved", "FFmpeg tidak ditemukan di PC.");
  await add(s.channelId, "Asal nama pasar", "published");
  await add(s.channelId, "Topik yang ditolak", "rejected");
  const [general] = await sql`insert into public.tasks (office_id, agent_id, name, kind, trigger) values (${f.officeId}, ${s.writerId}, 'Rekap mingguan', 'general', 'manual') returning id`;
  const [report] = await sql`insert into public.task_runs (office_id, task_id, agent_id, status, trigger_source, output, started_at, finished_at)
    values (${f.officeId}, ${general.id}, ${s.writerId}, 'succeeded', 'manual', ${sql.json({ summary_md: "Tiga topik naik minggu ini." })}, now(), now()) returning id`;
  await sql`insert into public.task_runs (office_id, task_id, agent_id, channel_id, status, trigger_source, error, started_at, finished_at)
    values (${f.officeId}, ${s.researchTaskId}, ${s.researcherId}, ${s.channelId}, 'failed', 'manual', 'Kunci Claude ditolak (401).', now(), now())`;
  return { f, s, channel2: ch2.id as string, waiting, videoFailed, report: report.id as string };
}

const tabs = (page: Page) => page.getByRole("navigation", { name: "Keadaan konten" });
const list = (page: Page, name: string) => page.getByRole("region", { name });
const detail = (page: Page) => page.getByRole("complementary", { name: "Detail" });

test.describe("Navigasi 6 menu + Pengaturan", () => {
  test("NAV-H1 menu atas: enam menu, halaman lama ikut menu induknya", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    await expect(nav.getByRole("link")).toHaveText(["Kantor", "Konten", "Jadwal", "Channel", "Agent", "Pengaturan"]);

    await page.goto(`/o/${f.slug}/tugas`);
    await expect(nav.getByRole("link", { name: "Agent" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Bagian Agent" }).getByRole("link", { name: /^Tugas/ })).toHaveAttribute("aria-current", "page");

    await page.goto(`/o/${f.slug}/kunci`);
    await expect(nav.getByRole("link", { name: "Pengaturan" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: "Kunci & layanan" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("navigation", { name: "Bagian pengaturan" }).getByRole("link", { name: "PC dan perangkat" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/perangkat$`));
    await expectA11y(page, "Pengaturan: PC");
  });

  test("NAV-H2 Asisten dari halaman mana pun: Ctrl J buka, Esc tutup, tautan di chat menutup panel", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);
    const panel = page.getByRole("dialog", { name: "Asisten" });
    // Pintasan aktif setelah halaman selesai dimuat (hydration): ulangi sampai panel terbuka.
    const openWithShortcut = () =>
      expect(async () => {
        if (!(await panel.isVisible())) await page.keyboard.press("Control+j");
        await expect(panel).toBeVisible({ timeout: 2_000 });
      }).toPass();
    await openWithShortcut();
    await expect(panel.getByRole("log", { name: "Percakapan dengan Asisten" })).toContainText("Halo, aku Asisten.");
    await expectA11y(page, "panel Asisten");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await openWithShortcut();
    await panel.getByRole("button", { name: "Mulai setup" }).click();
    await expect(panel.getByText("Pertama, sambungkan PC kamu.")).toBeVisible();
    await panel.getByRole("link", { name: "Buka Perangkat" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/perangkat$`));
    await expect(panel).toBeHidden();
  });

  test("SET-H1 ganti nama kantor: tampil di menu atas", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/pengaturan`);
    await expectA11y(page, "Pengaturan: Kantor");
    await page.getByLabel("Nama kantor").fill("  Studio   Senja  ");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("Nama kantor disimpan", { exact: true })).toBeVisible();
    const [o] = await sql`select display_name from public.offices where id = ${f.officeId}`;
    expect(o.display_name).toBe("Studio Senja");
    await page.reload();
    await expect(page.getByRole("banner").getByText("Studio Senja")).toBeVisible();
  });

  test("SET-H2 ganti password: lama salah ditolak, berhasil, lalu masuk dengan password baru (SET-N1)", async ({ page }) => {
    await sql`delete from public.rate_limits`;
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/pengaturan/akun`);
    await expectA11y(page, "Pengaturan: Akun");
    const fill = async (old: string, next: string, again: string) => {
      await page.getByLabel("Password lama").fill(old);
      await page.getByLabel("Password baru", { exact: true }).fill(next);
      await page.getByLabel("Ulangi password baru").fill(again);
      await page.getByRole("button", { name: "Ganti password" }).click();
    };
    await fill("bukan-password-ini", "rahasia-baru-123", "rahasia-baru-123");
    await expect(page.getByText("Password lama salah.")).toBeVisible();
    await fill(f.password, "rahasia-baru-123", "rahasia-lain-123");
    await expect(page.getByText("Ulangan password baru tidak sama.")).toBeVisible();
    await fill(f.password, "rahasia-baru-123", "rahasia-baru-123");
    await expect(page.getByText("Password diganti", { exact: true })).toBeVisible();

    // Sesi browser ini tetap masuk setelah password lama dicek.
    await page.goto(`/o/${f.slug}/agent`);
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent$`));
    await page.getByRole("button", { name: "Akun" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/masuk$`));
    await login(page, { ...f, password: "rahasia-baru-123" });
  });
});

test.describe("F21 Konten per keadaan", () => {
  test("F21-H1 tab berhitungan, saring channel, cari judul, detail di panel kanan", async ({ page }) => {
    const { f, channel2, waiting, report } = await officeWithContents();
    await login(page, f);
    await page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Konten" }).click();
    await expect(page.getByText("2 menunggu keputusan kamu")).toBeVisible();
    await expect(tabs(page).getByRole("link")).toHaveText([
      "Perlu keputusan2",
      "Gagal2",
      "Sedang dikerjakan0",
      "Siap & terjadwal0",
      "Terbit1",
      "Laporan1",
      "Ditolak1",
    ]);
    await expectA11y(page, "S21 konten");

    // Saring channel kedua: hanya satu yang menunggu.
    await page.getByRole("navigation", { name: "Saring per channel" }).getByRole("link", { name: /^Profesi Unik/ }).click();
    await expect(page).toHaveURL(new RegExp(`kanal=${channel2}`));
    await expect(list(page, "Perlu keputusan").getByRole("link")).toHaveCount(1);
    await expect(list(page, "Perlu keputusan")).toContainText("mercusuar");

    // Cari judul di semua channel.
    await page.getByRole("navigation", { name: "Saring per channel" }).getByRole("link", { name: /^Semua channel/ }).click();
    await expect(page).not.toHaveURL(/kanal=/);
    await page.getByRole("searchbox", { name: "Cari judul" }).fill("laut");
    await page.getByRole("searchbox", { name: "Cari judul" }).press("Enter");
    await expect(page).toHaveURL(/q=laut/);
    await expect(list(page, "Perlu keputusan").getByRole("link")).toHaveCount(1);
    await list(page, "Perlu keputusan").getByRole("link", { name: /Kenapa laut asin/ }).click();
    await expect(page).toHaveURL(new RegExp(`pilih=${waiting}`));
    await expect(detail(page).getByRole("heading", { name: "Kenapa laut asin" })).toBeVisible();
    await expect(detail(page).getByRole("button", { name: "Setujui" })).toBeVisible();

    // Gagal: video gagal (alasan dari PC) + tugas gagal tanpa konten. Kata kunci ikut terbawa antar tab, jadi hapus dulu.
    await list(page, "Perlu keputusan").or(detail(page)).first().waitFor();
    await page.goto(`/o/${f.slug}/konten`);
    await tabs(page).getByRole("link", { name: /^Gagal/ }).click();
    await expect(list(page, "Gagal")).toContainText("FFmpeg tidak ditemukan di PC.");
    await expect(list(page, "Gagal")).toContainText("Kunci Claude ditolak (401).");

    // Laporan tugas umum.
    await tabs(page).getByRole("link", { name: /^Laporan/ }).click();
    await list(page, "Laporan").getByRole("link", { name: /Rekap mingguan/ }).click();
    await expect(page).toHaveURL(new RegExp(`tab=laporan&pilih=${report}`));
    await expect(detail(page)).toContainText("Tiga topik naik minggu ini.");
    await expectA11y(page, "S21 laporan");
  });

  test("F21-E1 HP 390px: memilih konten membuka detail penuh dengan tombol kembali", async ({ page }) => {
    const { f, waiting } = await officeWithContents();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    await page.goto(`/o/${f.slug}/konten`);
    await list(page, "Perlu keputusan").getByRole("link", { name: /Kenapa laut asin/ }).click();
    await expect(page).toHaveURL(new RegExp(`pilih=${waiting}`));
    await expect(list(page, "Perlu keputusan")).toBeHidden();
    await expect(detail(page).getByRole("button", { name: "Setujui" })).toBeInViewport();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expectA11y(page, "S22 detail di HP");
    await detail(page).getByRole("link", { name: "Kembali ke daftar" }).click();
    await expect(list(page, "Perlu keputusan")).toBeVisible();
  });

  test("F21-N1 konten kantor lain tidak bisa dipilih lewat URL", async ({ page }) => {
    const a = await officeWithContents();
    const b = await createOffice();
    await login(page, b);
    await page.goto(`/o/${b.slug}/konten?pilih=${a.waiting}`);
    await expect(detail(page)).not.toContainText("Kenapa laut asin");
    await page.goto(`/o/${b.slug}/konten/${a.waiting}`);
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
  });
});
