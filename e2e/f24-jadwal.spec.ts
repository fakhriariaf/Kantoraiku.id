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
    const row = page.getByRole("row", { name: /Fakta Uji/ }).filter({ visible: true }).first();
    await expect(row).toContainText("07.30");
    await expect(row).toContainText("16.00");

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
    // Video terjadwal di grid: buka kartunya, tandai dari halaman konten.
    await page.getByRole("table", { name: /Jadwal posting per channel/ }).getByRole("link", { name: /Video siap terbit/ }).click();
    await expect(page).toHaveURL(new RegExp(`/konten/${v.id}$`));

    await page.getByRole("button", { name: "Tandai sudah diposting: Video siap terbit" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/Link postingan/).fill("bukan-link");
    await dialog.getByRole("button", { name: "Tandai" }).click();
    await expect(dialog.getByText("Link postingan harus diawali http:// atau https://.")).toBeVisible();
    await expectA11y(page, "S24 dialog tandai");
    await dialog.getByLabel(/Link postingan/).fill("https://www.tiktok.com/@uji/video/123");
    await dialog.getByRole("button", { name: "Tandai" }).click();
    await expect(text(page, "Ditandai sudah diposting")).toBeVisible();
    await page.goto(`/o/${f.slug}/jadwal`);
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

test.describe("S24 grid jadwal 7 hari", () => {
  test("S24-H3 grid: slot per jam posting, video di slotnya, slot kosong diisi dari antrean", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    // Channel tanpa jam posting dulu: video masuk antrean (tidak terjadwal otomatis).
    const queued = await approvedVideo(f.officeId, s.channelId, "Video di antrean");
    expect(queued.stage).toBe("video_approved");
    await sql`update public.channels set post_times = '{09:00,21:00}' where id = ${s.channelId}`;
    const scheduled = await approvedVideo(f.officeId, s.channelId, "Video terjadwal");
    expect(scheduled.stage).toBe("scheduled");

    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);
    const grid = page.getByRole("table", { name: /Jadwal posting per channel/ });
    await expect(grid.getByRole("row", { name: /Fakta Uji/ })).toContainText("Antrean: 1");
    await expect(grid.getByRole("link", { name: /Video terjadwal/ })).toBeVisible();
    // Slot yang sudah berisi video tidak tampil lagi sebagai slot kosong.
    const fillButtons = grid.getByRole("button", { name: /Isi slot Fakta Uji/ });
    const before = await fillButtons.count();
    expect(before).toBeGreaterThan(0);
    await expectA11y(page, "S24 grid");

    await fillButtons.last().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "Video di antrean" })).toBeChecked();
    await expectA11y(page, "S24 dialog isi slot");
    await dialog.getByRole("button", { name: "Jadwalkan" }).click();
    await expect(text(page, /^Dijadwalkan /)).toBeVisible();
    await expect(grid.getByRole("row", { name: /Fakta Uji/ })).toContainText("Antrean: kosong");
    await expect(grid.getByRole("link", { name: /Video di antrean/ })).toBeVisible();

    const [c] = await sql`select stage, scheduled_at, (scheduled_at at time zone 'Asia/Jakarta')::time::text as local from public.contents where id = ${queued.id}`;
    expect(c.stage).toBe("scheduled");
    expect(["09:00:00", "21:00:00"]).toContain(c.local);
    expect(c.scheduled_at.getTime()).toBeGreaterThan(Date.now());
  });

  test("S24-N2 satu slot satu video: indeks unik menolak slot dobel", async () => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`update public.channels set post_times = '{16:00}' where id = ${s.channelId}`;
    const a = await approvedVideo(f.officeId, s.channelId, "Pertama");
    const [b] = await sql`insert into public.contents (office_id, channel_id, title, stage) values (${f.officeId}, ${s.channelId}, 'Kedua', 'video_approved') returning id`;
    await expect(sql`update public.contents set stage = 'scheduled', scheduled_at = ${a.scheduled_at} where id = ${b.id}`).rejects.toThrow(/contents_one_per_slot/);
  });

  test("S24-E4 minggu depan dan kembali ke hari ini", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`update public.channels set post_times = '{16:00}' where id = ${s.channelId}`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/jadwal`);
    await expect(page.getByRole("heading", { name: /^7 hari ke depan/ })).toBeVisible();
    await page.getByRole("link", { name: "7 hari berikutnya" }).click();
    await expect(page).toHaveURL(/mulai=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("heading", { name: /^7 hari / })).not.toContainText("ke depan");
    await page.getByRole("link", { name: "Hari ini", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^7 hari ke depan/ })).toBeVisible();
  });
});

test.describe("S17 tabel channel", () => {
  test("S17-H2 grup channel, jam riset dari tugas riset, per hari = jumlah jam posting", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`update public.channels set post_times = '{07:00,19:00}' where id = ${s.channelId}`;
    await sql`update public.tasks set trigger = 'schedule', schedule_times = '{06:30}', schedule_days = '{1,2,3,4,5,6,7}' where id = ${s.researchTaskId}`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/channel/${s.channelId}`);
    await page.getByLabel("Grup").fill("Shorts Indonesia");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page).toHaveURL(/\/channel\?disimpan=/);

    const group = page.getByRole("region", { name: "Shorts Indonesia" });
    await expect(group.getByRole("heading", { name: "Shorts Indonesia" })).toBeVisible();
    const row = group.getByRole("row", { name: /Fakta Uji/ });
    await expect(row).toContainText("06.30"); // jam riset
    await expect(row.getByRole("cell").last()).toHaveText("2"); // per hari
    await expectA11y(page, "S17 tabel channel");
    const [ch] = await sql`select group_name from public.channels where id = ${s.channelId}`;
    expect(ch.group_name).toBe("Shorts Indonesia");
  });
});
