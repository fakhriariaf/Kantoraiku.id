import { addContentSetup, createOffice, expect, expectA11y, login, sql, test, visible } from "./helpers";

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();

/** Konten di tahap video menunggu persetujuan, lalu disetujui lewat SQL (memicu penjadwalan). */
async function approvedVideo(officeId: string, channelId: string, title: string) {
  const [c] = await sql`insert into public.contents (office_id, channel_id, title, script, stage, duration_s, video_local_ref)
    values (${officeId}, ${channelId}, ${title}, 'Naskah uji.', 'video_review', 30, 'C:/Videos/uji.mp4') returning id`;
  await sql`update public.contents set stage = 'video_approved' where id = ${c.id}`;
  const [r] = await sql`select id, stage, scheduled_at from public.contents where id = ${c.id}`;
  return r as { id: string; stage: string; scheduled_at: Date | null };
}

test.describe("S24 jadwal terbit", () => {
  test("S24-H1 atur jam posting di channel -> video disetujui terjadwal di slot berikutnya, slot tidak dobel", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);

    await page.goto(`/o/${f.slug}/channel`);
    await expect(text(page, "Belum ada jam posting")).toBeVisible();
    await page.getByRole("link", { name: "Atur channel Fakta Uji" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/channel\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Fakta Uji", level: 1 }).filter({ visible: true })).toBeVisible();
    await expectA11y(page, "S18 atur channel");
    await page.getByLabel("Jam posting 1").filter({ visible: true }).first().fill("16:00");
    await page.getByRole("button", { name: "Tambah jam" }).filter({ visible: true }).first().click();
    await page.getByLabel("Jam posting 2").filter({ visible: true }).first().fill("07:30");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(text(page, 'Channel "Fakta Uji" tersimpan')).toBeVisible();
    await expect(text(page, "Posting: 07.30, 16.00 WIB")).toBeVisible();

    const a = await approvedVideo(f.officeId, s.channelId, "Video pertama");
    const b = await approvedVideo(f.officeId, s.channelId, "Video kedua");
    expect(a.stage).toBe("scheduled");
    expect(b.stage).toBe("scheduled");
    const [exp] = await sql`select public.next_run_after('{07:30,16:00}'::time[], '{1,2,3,4,5,6,7}'::smallint[], 'Asia/Jakarta', now()) as first`;
    expect(a.scheduled_at!.getTime()).toBe(new Date(exp.first).getTime());
    expect(b.scheduled_at!.getTime()).toBeGreaterThan(a.scheduled_at!.getTime()); // slot berikutnya, tidak dobel

    await page.goto(`/o/${f.slug}/jadwal`);
    await expect(visible(page, "link", "Video pertama")).toBeVisible();
    await expect(visible(page, "link", "Video kedua")).toBeVisible();
    await expectA11y(page, "S24 jadwal");
  });

  test("S24-H2 tandai sudah diposting dengan link -> pindah ke Sudah terbit", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`update public.channels set post_times = '{16:00}' where id = ${s.channelId}`;
    const v = await approvedVideo(f.officeId, s.channelId, "Video siap terbit");
    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);

    await page.getByRole("button", { name: "Tandai sudah diposting: Video siap terbit" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Link postingan/).fill("bukan-link");
    await dialog.getByRole("button", { name: "Tandai" }).click();
    await expect(dialog.getByText("Link postingan harus diawali http:// atau https://.")).toBeVisible();
    await expectA11y(page, "S24 dialog tandai");
    await dialog.getByLabel(/Link postingan/).fill("https://www.tiktok.com/@uji/video/123");
    await dialog.getByRole("button", { name: "Tandai" }).click();
    await expect(text(page, "Ditandai sudah diposting")).toBeVisible();
    await expect(text(page, "Sudah terbit")).toBeVisible();
    await expect(visible(page, "link", "Lihat postingan")).toHaveAttribute("href", "https://www.tiktok.com/@uji/video/123");

    const [c] = await sql`select stage, published_at, publish_results from public.contents where id = ${v.id}`;
    expect(c.stage).toBe("published");
    expect(c.published_at).not.toBeNull();
    expect(c.publish_results[0]).toMatchObject({ provider: "manual", url: "https://www.tiktok.com/@uji/video/123" });

    await page.goto(`/o/${f.slug}/konten/${v.id}`);
    await expect(text(page, /Sudah diposting/)).toBeVisible();
  });

  test("S24-E1 channel tanpa jam posting: video tetap disetujui, muncul di Waktunya posting", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const v = await approvedVideo(f.officeId, s.channelId, "Tanpa jadwal");
    expect(v.stage).toBe("video_approved");
    expect(v.scheduled_at).toBeNull();
    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);
    await expect(text(page, "Waktunya posting")).toBeVisible();
    await expect(visible(page, "link", "Tanpa jadwal")).toBeVisible();
    await page.goto(`/o/${f.slug}/konten/${v.id}`);
    await expect(text(page, /belum punya jam posting/)).toBeVisible();
  });

  test("S24-E2 jadwal lewat: muncul di Waktunya posting; kosong: ajakan atur jam posting", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);
    await expect(text(page, "Belum ada video yang dijadwalkan")).toBeVisible();
    await expectA11y(page, "S24 kosong");

    await sql`update public.channels set post_times = '{16:00}' where id = ${s.channelId}`;
    const v = await approvedVideo(f.officeId, s.channelId, "Sudah lewat jam");
    await sql`update public.contents set scheduled_at = now() - interval '1 hour' where id = ${v.id}`;
    await page.goto(`/o/${f.slug}/jadwal`);
    await expect(text(page, "Waktunya posting")).toBeVisible();
    await expect(visible(page, "link", "Sudah lewat jam")).toBeVisible();
  });

  test("S24-N1 tandai dua kali dan konten kantor lain ditolak", async ({ page }) => {
    const other = await createOffice();
    const os = await addContentSetup(other.officeId);
    const foreign = await approvedVideo(other.officeId, os.channelId, "Milik kantor lain");
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const v = await approvedVideo(f.officeId, s.channelId, "Video sekali");
    await login(page, f);

    await page.goto(`/o/${f.slug}/konten/${v.id}`);
    await page.getByRole("button", { name: /sudah diposting/ }).filter({ visible: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Tandai" }).click();
    await expect(text(page, "Ditandai sudah diposting")).toBeVisible();
    await expect(page.getByRole("button", { name: /sudah diposting/ }).filter({ visible: true })).toHaveCount(0);

    await page.goto(`/o/${f.slug}/konten/${foreign.id}`);
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
    const [still] = await sql`select stage from public.contents where id = ${foreign.id}`;
    expect(still.stage).toBe("video_approved");
  });

  test("S24-E3 lebar HP 390px: jadwal dan atur channel tanpa scroll horizontal", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`update public.channels set post_times = '{16:00}' where id = ${s.channelId}`;
    await approvedVideo(f.officeId, s.channelId, "J".repeat(60));
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    for (const path of ["/jadwal", `/channel/${s.channelId}`]) {
      await page.goto(`/o/${f.slug}${path}`);
      await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await expectA11y(page, "S18 390px");
  });
});
