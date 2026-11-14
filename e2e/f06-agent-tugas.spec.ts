import { addContentSetup, createOffice, expect, expectA11y, login, sql, test, visible } from "./helpers";

const field = (page: import("@playwright/test").Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true }).first();

async function newAgent(page: import("@playwright/test").Page, slug: string, name: string, title = "Periset") {
  await page.goto(`/o/${slug}/agent/baru`);
  await field(page, "Nama").fill(name);
  await field(page, "Jabatan").fill(title);
  await field(page, "Job desk").fill("Cari topik yang sedang ramai.");
  await page.getByRole("button", { name: "Buat agent" }).click();
}

test.describe("F06 agent", () => {
  test("F06-H1 buat agent -> kartu muncul dengan otak Simulasi", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await expectA11y(page, "S14 agent baru");
    await newAgent(page, f.slug, "Bayu");
    await expect(page.getByText("Bayu sudah bergabung")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bayu" })).toBeVisible();
    await expectA11y(page, "S13 daftar agent");
  });

  test("F06-H4 buat agent ber-otak Claude: model kosong memakai default konektor", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").fill("Citra");
    await field(page, "Jabatan").fill("Penulis naskah");
    await page.getByRole("radio", { name: /Claude/ }).click();
    await expect(page.getByLabel(/^Model/).filter({ visible: true }).first()).toHaveAttribute("placeholder", "claude-opus-5-5");
    await expectA11y(page, "S14 agent baru, otak Claude");
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Citra sudah bergabung")).toBeVisible();
    const [a] = await sql`select brain, model from public.agents where office_id = ${f.officeId} and name = 'Citra'`;
    expect(a).toEqual({ brain: "claude", model: null });
  });

  test("F06-E1 nama lebih dari 40 karakter ditolak server", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").evaluate((el: HTMLInputElement) => el.removeAttribute("maxlength"));
    await field(page, "Nama").fill("N".repeat(60));
    await field(page, "Jabatan").fill("Periset");
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Maksimal 40 karakter.")).toBeVisible();
  });

  test("F06-E2 nama dengan aksen dan emoji tersimpan utuh", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await newAgent(page, f.slug, "Ñoño 🤖", "Penulis naskah");
    await expect(page.getByRole("heading", { name: "Ñoño 🤖" })).toBeVisible();
  });

  test("F06-N1 nama agent dobel ditolak", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await newAgent(page, f.slug, "Sari");
    await expect(page.getByText("Sari sudah bergabung")).toBeVisible();
    await newAgent(page, f.slug, "sari");
    await expect(page.getByText("Sudah ada agent dengan nama ini.")).toBeVisible();
  });

  test("F06-E3 isian tidak hilang setelah error validasi", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await newAgent(page, f.slug, "Rina");
    await expect(page.getByText("Rina sudah bergabung")).toBeVisible();
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").fill("Rina");
    await field(page, "Jabatan").fill("Penulis naskah");
    await field(page, "Job desk").fill("Job desk panjang yang sudah diketik dengan susah payah.");
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Sudah ada agent dengan nama ini.")).toBeVisible();
    await expect(field(page, "Job desk")).toHaveValue("Job desk panjang yang sudah diketik dengan susah payah.");
    await expect(field(page, "Jabatan")).toHaveValue("Penulis naskah");
  });

  test("F07-E3 form tugas: isian tidak hilang setelah error validasi", async ({ page }) => {
    const f = await createOffice();
    await sql`insert into public.agents (office_id, name, title, brain) values (${f.officeId}, 'Tanpa Channel', 'Periset', 'simulation')`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await field(page, "Nama tugas").fill("Riset yang gagal");
    await page.getByLabel("Instruksi tambahan").filter({ visible: true }).first().fill("Instruksi penting");
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.getByText("Tugas riset, naskah, dan video butuh channel.")).toBeVisible();
    await expect(field(page, "Nama tugas")).toHaveValue("Riset yang gagal");
    await expect(page.getByLabel("Instruksi tambahan").filter({ visible: true }).first()).toHaveValue("Instruksi penting");
  });

  test("F06-H2 ubah agent; F06-H3 arsipkan agent", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await newAgent(page, f.slug, "Dimas");
    await expect(page.getByText("Dimas sudah bergabung")).toBeVisible();
    await page.getByRole("link", { name: "Dimas" }).filter({ visible: true }).click();
    await field(page, "Jabatan").fill("Penulis naskah senior");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent$`));
    await expect(page.getByText("Penulis naskah senior")).toBeVisible();

    await visible(page, "button", "Menu Dimas").click();
    await page.getByRole("menuitem", { name: "Arsipkan" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Arsipkan" }).click();
    await expect(page.getByRole("heading", { name: "Dimas" })).toHaveCount(0);
  });
});

test.describe("F07 tugas", () => {
  test("F07-H1 buat tugas riset lalu tugas 'setelah tugas lain' lewat UI", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await sql`delete from public.tasks where office_id = ${f.officeId}`; // mulai dari daftar tugas kosong
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await expectA11y(page, "S16 tugas");

    await field(page, "Nama tugas").fill("Riset pagi");
    await field(page, "Agent").selectOption({ label: "Periset Uji" });
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.getByText("Riset pagi").filter({ visible: true }).first()).toBeVisible();

    await field(page, "Nama tugas").fill("Naskah sore");
    await field(page, "Agent").selectOption({ label: "Penulis Uji" });
    await field(page, "Jenis tugas").selectOption("script");
    await page.getByRole("radio", { name: "Setelah tugas lain" }).click();
    await field(page, "Jalan setelah").selectOption({ label: "Riset pagi" });
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.getByText('Setelah "Riset pagi" selesai').filter({ visible: true }).first()).toBeVisible();

    const rows = await sql`select t.name, p.name as after from public.tasks t left join public.tasks p on p.id = t.after_task_id where t.office_id = ${f.officeId} order by t.created_at`;
    expect(rows.map((r) => [r.name, r.after])).toEqual([["Riset pagi", null], ["Naskah sore", "Riset pagi"]]);
    void s;
  });

  test("F07-N2 tugas riset tanpa channel ditolak", async ({ page }) => {
    const f = await createOffice();
    await sql`insert into public.agents (office_id, name, title, brain) values (${f.officeId}, 'Tanpa Channel', 'Periset', 'simulation')`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await field(page, "Nama tugas").fill("Riset tanpa channel");
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.getByText("Tugas riset, naskah, dan video butuh channel.")).toBeVisible();
  });

  test("F07-E1 tugas terjadwal: jam lokal WIB dan hari kerja", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await field(page, "Nama tugas").fill("Riset terjadwal");
    await field(page, "Agent").selectOption({ label: "Periset Uji" });
    await page.getByRole("radio", { name: "Terjadwal" }).click();
    await field(page, "Jam").fill("06:00");
    for (const d of ["Sabtu", "Minggu"]) await page.getByRole("button", { name: d }).click();
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.getByText("Sen-Jum pukul 06.00").filter({ visible: true }).first()).toBeVisible();
    const [t] = await sql`select to_char(next_run_at at time zone 'Asia/Jakarta', 'HH24:MI') as hm, extract(isodow from next_run_at at time zone 'Asia/Jakarta')::int as dow
                          from public.tasks where office_id = ${f.officeId} and name = 'Riset terjadwal'`;
    expect(t.hm).toBe("06:00");
    expect(t.dow).toBeLessThanOrEqual(5);
    void s;
  });
});
