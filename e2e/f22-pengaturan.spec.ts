import { addContentSetup, connector, createOffice, expect, expectA11y, login, queueRun, setupCode, sql, test, visible } from "./helpers";

type Page = import("@playwright/test").Page;
const text = (page: Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();
const field = (page: Page, label: string | RegExp) =>
  page.getByLabel(label, typeof label === "string" ? { exact: true } : undefined).filter({ visible: true }).first();

/** Tugas video (butuh kemampuan "video" di PC) untuk channel uji. */
async function videoTask(officeId: string, agentId: string, channelId: string) {
  const [t] = await sql`insert into public.tasks (office_id, agent_id, channel_id, name, kind, trigger, required_capability)
    values (${officeId}, ${agentId}, ${channelId}, 'Video uji', 'video', 'manual', 'video') returning id`;
  return t.id as string;
}

test.describe("Pengaturan Paket C", () => {
  test.beforeEach(async () => {
    await sql`delete from public.rate_limits`;
  });

  test("SET-H3 batas revisi: diubah di Pengaturan > Kantor, tombol Revisi mati saat tercapai", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const [c] = await sql`insert into public.contents (office_id, channel_id, title, script, stage, revision)
      values (${f.officeId}, ${s.channelId}, 'Naskah revisi kedua', 'Isi.', 'script_review', 1) returning id`;
    await sql`insert into public.approvals (office_id, content_id, stage, revision) values (${f.officeId}, ${c.id}, 'script', 1)`;
    await login(page, f);

    await page.goto(`/o/${f.slug}/konten/${c.id}`);
    await expect(visible(page, "button", "Revisi")).toBeEnabled(); // bawaan 3: masih boleh

    await page.goto(`/o/${f.slug}/pengaturan`);
    const group = page.getByRole("group", { name: "Batas revisi" });
    await expect(group.locator("output")).toHaveText("3");
    await group.getByRole("button", { name: "Kurangi batas revisi" }).click();
    await expect(group.locator("output")).toHaveText("2");
    await group.getByRole("button", { name: "Kurangi batas revisi" }).click();
    await expect(group.locator("output")).toHaveText("1");
    await expect.poll(async () => (await sql`select max_revisions from public.offices where id = ${f.officeId}`)[0].max_revisions).toBe(1);
    await expectA11y(page, "Pengaturan: Kantor + batas revisi");

    await page.goto(`/o/${f.slug}/konten/${c.id}`);
    await expect(visible(page, "button", "Revisi")).toBeDisabled();
    await expect(text(page, /Batas revisi \(1 kali\) sudah tercapai/)).toBeVisible();
    await visible(page, "button", "Setujui").click();
    await expect(text(page, "Naskah disetujui")).toBeVisible();
  });

  test("SET-H4 anggaran: biaya melewati ambang -> mode hemat aktif, tugas prioritas rendah dilewati PC", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);
    await page.goto(`/o/${f.slug}/pengaturan/hemat`);
    await expectA11y(page, "Pengaturan: Anggaran & hemat");
    await field(page, /Anggaran AI per bulan/).fill("10");
    await field(page, /Nyalakan mode hemat pada/).fill("50");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(text(page, "Anggaran disimpan")).toBeVisible();
    const [o] = await sql`select saver_mode, ai_budget_cents::int as cents, saver_threshold_pct from public.offices where id = ${f.officeId}`;
    expect(o).toEqual({ saver_mode: "auto", cents: 1000, saver_threshold_pct: 50 });

    // $6 dari $10 (60% >= 50%): mode hemat menyala.
    await sql`insert into public.task_runs (office_id, task_id, agent_id, channel_id, status, trigger_source, started_at, finished_at, cost_usd_micros)
      values (${f.officeId}, ${s.researchTaskId}, ${s.researcherId}, ${s.channelId}, 'succeeded', 'manual', now(), now(), 6000000)`;
    await page.reload();
    await expect(text(page, "Mode hemat aktif")).toBeVisible();
    await expect(text(page, /\$6\.00/)).toBeVisible();

    await sql`update public.tasks set priority = 0 where id = ${s.researchTaskId}`;
    const runId = await queueRun(f.officeId, s.researchTaskId);
    await sql`update public.task_runs set priority = 0 where id = ${runId}`;
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await c.runOnce();
    const [r] = await sql`select status, skipped_reason from public.task_runs where id = ${runId}`;
    expect(r.status).toBe("skipped");
    expect(r.skipped_reason).toMatch(/Mode hemat/);

    await page.goto(`/o/${f.slug}`);
    await expect(page.getByRole("region", { name: "Biaya AI bulan ini" })).toContainText("$6.00 dari $10.00");
  });

  test("SET-H5 PC tanpa video tidak mengambil tugas video; video hanya saat dicas", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const vt = await videoTask(f.officeId, s.writerId, s.channelId);
    const plugged = connector();
    await plugged.pair(await setupCode(f.officeId), "Laptop Uji");
    await login(page, f);

    // Matikan "Pakai untuk video": tugas video tetap di antrean.
    await page.goto(`/o/${f.slug}/perangkat`);
    await page.getByRole("switch", { name: "Pakai untuk video" }).click();
    await expect(text(page, "Laptop Uji tidak lagi membuat video")).toBeVisible();
    await expect(text(page, "Tidak ada PC yang membuat video")).toBeVisible();
    await expectA11y(page, "Pengaturan: PC tanpa video");
    const run1 = await queueRun(f.officeId, vt);
    await sql`update public.task_runs set required_capability = 'video' where id = ${run1}`;
    await plugged.runOnce();
    expect((await sql`select status from public.task_runs where id = ${run1}`)[0].status).toBe("queued");

    // Nyalakan lagi, lalu atur "hanya saat dicas" dan jalankan konektor yang memakai baterai.
    await page.getByRole("switch", { name: "Pakai untuk video" }).click();
    await expect(text(page, "Laptop Uji dipakai untuk video")).toBeVisible();
    await page.goto(`/o/${f.slug}/pengaturan/video`);
    await page.getByRole("switch", { name: "Buat video hanya saat laptop dicas" }).click();
    await expect(text(page, "Video hanya dibuat saat dicas")).toBeVisible();
    await expectA11y(page, "Pengaturan: Video");

    const onBattery = connector({ KANTORAIKU_ON_BATTERY: "1", KANTORAIKU_CONFIG_DIR: plugged.dir });
    await onBattery.runOnce();
    expect((await sql`select status from public.task_runs where id = ${run1}`)[0].status).toBe("queued");
    expect((await sql`select on_battery from public.devices where office_id = ${f.officeId}`)[0].on_battery).toBe(true);
    await page.reload();
    await expect(page.getByText("Memakai baterai").first()).toBeVisible();
  });

  test("SET-H6 ganti PC: slot penuh, kode ganti, PC lama dicabut saat PC baru tersambung", async ({ page }) => {
    const f = await createOffice();
    const old = connector();
    await old.pair(await setupCode(f.officeId), "PC Lama");
    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    await expect(text(page, "1 dari 1 slot PC terpakai")).toBeVisible();
    await expect(visible(page, "button", "Buat kode setup")).toHaveCount(0);
    await visible(page, "button", "Ganti PC").click();
    const dialog = page.getByRole("dialog", { name: "Ganti PC" });
    await expect(dialog.getByRole("radio", { name: "PC Lama" })).toBeChecked();
    await dialog.getByRole("button", { name: "Buat kode" }).click();
    const codeEl = dialog.locator('[aria-label^="Kode setup"]');
    await expect(codeEl).toBeVisible();
    await expectA11y(page, "Ganti PC: kode");
    const code = (await codeEl.textContent())!.replace(/\s/g, "");

    const fresh = connector();
    const out = await fresh.pair(code, "PC Baru");
    expect(out.stdout).toContain("Tersambung");
    const devs = await sql`select name, status from public.devices where office_id = ${f.officeId} order by created_at`;
    expect(devs).toEqual([
      { name: "PC Lama", status: "revoked" },
      { name: "PC Baru", status: "online" },
    ]);
    // Konektor PC lama ditolak server (keluar dengan kode galat).
    const err = (await old.runOnce().catch((e) => e)) as { stdout?: string; code?: number };
    expect(err.code).toBe(1);
    expect(err.stdout).toContain("sudah dicabut dari kantor");
  });
});

test.describe("CS: cara membalas", () => {
  async function csOffice(page: Page) {
    const f = await createOffice();
    await sql`insert into public.agents (office_id, name, title, brain) values (${f.officeId}, 'CS Uji', 'Customer service', 'simulation')`;
    await sql`insert into public.business_infos (office_id, title, body, position) values (${f.officeId}, 'Jam buka', 'Toko buka pukul 09.00 sampai 21.00.', 0)`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs`);
    await field(page, "Agent CS simulasi").selectOption({ label: "CS Uji" });
    await expect(text(page, "Agent CS tersimpan")).toBeVisible();
    return f;
  }
  async function ask(page: Page, slug: string, name: string, msg: string) {
    await page.goto(`/o/${slug}/cs`);
    await field(page, "Nama pelanggan").fill(name);
    await field(page, "Pesan pelanggan").fill(msg);
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(page).toHaveURL(/\/cs\/[0-9a-f-]{36}$/);
  }
  const queued = async (officeId: string) =>
    (await sql`select count(*)::int as n from public.task_runs r join public.tasks t on t.id = r.task_id where r.office_id = ${officeId} and t.kind = 'cs_reply' and r.status = 'queued'`)[0].n;

  test("CS-H4 sapaan kak + balasan singkat saat PC mati (sekali per jam)", async ({ page }) => {
    const f = await csOffice(page);
    await page.getByRole("radio", { name: "kak" }).click();
    await field(page, /Balasan singkat saat PC mati/).fill("Pesanmu sudah kami terima, kak. Kami balas sebentar lagi.");
    await page.getByRole("button", { name: "Simpan pengaturan CS" }).click();
    await expect(text(page, "Pengaturan CS disimpan")).toBeVisible();
    await expectA11y(page, "CS: cara membalas");

    // Belum ada PC online: balasan singkat langsung terkirim, agent tetap mengantre.
    await ask(page, f.slug, "Dina", "Bisa bayar pakai kartu kredit?");
    await expect(text(page, "Pesanmu sudah kami terima, kak. Kami balas sebentar lagi.")).toBeVisible();
    await ask(page, f.slug, "Dina", "Halo?");
    const [{ n }] = await sql`select count(*)::int as n from public.cs_messages where office_id = ${f.officeId} and auto_kind = 'offline'`;
    expect(n).toBe(1);
    expect(await queued(f.officeId)).toBe(1); // pesan beruntun dijawab sekaligus

    // PC menyala: agent menjawab dengan sapaan "kak".
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await c.runOnce();
    await page.reload();
    await expect(text(page, /Pertanyaan kakak kami teruskan/)).toBeVisible();
  });

  test("CS-E2 CS dimatikan: chat tersimpan tanpa balasan; CS-E3 chat terlalu lama diserahkan ke kamu", async ({ page }) => {
    const f = await csOffice(page);
    await page.getByRole("switch", { name: "CS aktif" }).click();
    await page.getByRole("button", { name: "Simpan pengaturan CS" }).click();
    await expect(text(page, "Pengaturan CS disimpan")).toBeVisible();
    await ask(page, f.slug, "Eko", "Buka jam berapa?");
    expect(await queued(f.officeId)).toBe(0);

    await page.goto(`/o/${f.slug}/cs`);
    await page.getByRole("switch", { name: "CS aktif" }).click();
    await page.getByRole("button", { name: "Simpan pengaturan CS" }).click();
    await expect(text(page, "Pengaturan CS disimpan")).toBeVisible();
    await ask(page, f.slug, "Fani", "Buka jam berapa?");
    expect(await queued(f.officeId)).toBe(1);
    await sql`update public.task_runs set created_at = now() - interval '13 hours' where office_id = ${f.officeId} and status = 'queued'`;
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await c.runOnce();
    const [r] = await sql`select status, skipped_reason from public.task_runs r join public.tasks t on t.id = r.task_id where r.office_id = ${f.officeId} and t.kind = 'cs_reply'`;
    expect(r.status).toBe("skipped");
    expect(r.skipped_reason).toMatch(/lebih dari 12 jam/);
    const [conv] = await sql`select handled_by from public.cs_conversations where office_id = ${f.officeId} and customer_name = 'Fani'`;
    expect(conv.handled_by).toBe("human");
  });

  test("CS-H5 setelah pemilik membalas, CS diam lalu kembali setelah masa diam lewat", async ({ page }) => {
    const f = await csOffice(page);
    await ask(page, f.slug, "Gita", "Halo, buka jam berapa?");
    await field(page, "Balas sebagai kamu").fill("Buka jam 9 ya.");
    await page.getByRole("button", { name: "Kirim", exact: true }).filter({ visible: true }).first().click();
    await expect(text(page, "Buka jam 9 ya.")).toBeVisible();
    await sql`delete from public.task_runs where office_id = ${f.officeId}`;

    // Masih dalam masa diam (4 jam): tidak ada balasan agent.
    await ask(page, f.slug, "Gita", "Oke, kalau Minggu?");
    expect(await queued(f.officeId)).toBe(0);

    // Masa diam lewat: agent kembali memegang percakapan.
    await sql`update public.cs_messages set created_at = now() - interval '5 hours' where office_id = ${f.officeId} and sent_by = 'human'`;
    await ask(page, f.slug, "Gita", "Halo lagi?");
    expect(await queued(f.officeId)).toBe(1);
    const [conv] = await sql`select handled_by from public.cs_conversations where office_id = ${f.officeId} and customer_name = 'Gita'`;
    expect(conv.handled_by).toBe("agent");
  });
});
