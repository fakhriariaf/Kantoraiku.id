import { randomBytes } from "node:crypto";
import { addContentSetup, createOffice, expect, expectA11y, login, queueRun, sql, test } from "./helpers";

const field = (page: import("@playwright/test").Page, label: string) => page.getByLabel(label, { exact: true }).filter({ visible: true }).first();

async function onlinePc(officeId: string) {
  const [d] = await sql`insert into public.devices (office_id, kind, name, token_hash, public_key, status, last_seen_at)
    values (${officeId}, 'pc_windows', 'PC uji', ${randomBytes(32).toString("hex")}, 'kunci-uji', 'online', now()) returning id`;
  return d.id as string;
}

test.describe("F31 kantor virtual", () => {
  test("F31-H1 denah: agent duduk di ruangannya, klik label nama -> kartu dengan pekerjaannya", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const pc = await onlinePc(f.officeId);
    const run = await queueRun(f.officeId, s.researchTaskId);
    await sql`update public.task_runs set status = 'running', device_id = ${pc}, lease_expires_at = now() + interval '10 minutes',
      started_at = now(), progress_pct = 40 where id = ${run}`;
    await sql`update public.agents set status = 'working' where id = ${s.researcherId}`;
    await login(page, f);

    const map = page.getByRole("group", { name: "Denah kantor" });
    await expect(map).toBeVisible();
    await expect(map.getByText("PC offline")).toHaveCount(0);
    await expect(map.getByText("Kamu", { exact: true })).toBeVisible();
    const tag = map.getByRole("button", { name: /^Periset Uji, Periset, sedang bekerja/ });
    await expect(tag).toHaveAttribute("aria-pressed", "false");
    await expect(map.getByRole("button", { name: /^Penulis Uji, Penulis naskah, siap/ })).toBeVisible();
    await expect(map.getByRole("button", { name: /^Asisten/ })).toBeVisible();

    await tag.click();
    await expect(tag).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Periset · Ruang Riset")).toBeVisible();
    await expect(page.getByText("Mengerjakan 40%: Riset uji")).toBeVisible();
    await expectA11y(page, "S05 beranda dengan denah");
    await page.getByRole("link", { name: "Buka agent" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent/${s.researcherId}$`));
  });

  test("F31-H2 agent yang menunggu kamu langsung terpilih, dengan tombol Periksa", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await onlinePc(f.officeId);
    await sql`update public.agents set status = 'waiting_user' where id = ${s.writerId}`;
    await login(page, f);
    await expect(page.getByRole("button", { name: /^Penulis Uji, Penulis naskah, menunggu kamu/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "Periksa" }).last().click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/persetujuan$`));
  });

  test("F31-E1 PC offline: semua agent istirahat; kantor kosong tetap ada ajakan buat agent", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    const map = page.getByRole("group", { name: "Denah kantor" });
    await expect(map.getByText("PC offline: semua agent istirahat sampai PC menyala")).toBeVisible();
    await expect(map.getByRole("button", { name: /^Asisten, Asisten setup, istirahat/ })).toBeVisible();
    await expect(page.getByText("Kantor masih kosong")).toBeVisible();
  });

  test("F31-E2 ruangan penuh: agent ke lounge lalu koridor, sisanya disebut", async ({ page }) => {
    const f = await createOffice();
    for (let i = 1; i <= 26; i++) {
      await sql`insert into public.agents (office_id, name, title, desk_index) values (${f.officeId}, ${"Riset " + i}, 'Periset', ${i})`;
    }
    await login(page, f);
    const map = page.getByRole("group", { name: "Denah kantor" });
    // 3 kursi riset + 2 lounge + 6 koridor = 11 periset di denah, sisanya 15.
    await expect(map.getByRole("button", { name: /^Riset \d+,/ })).toHaveCount(11);
    await expect(page.getByText("15 agent lain belum kebagian tempat di denah.")).toBeVisible();
    await map.getByRole("button", { name: /^Riset 4,/ }).click();
    await expect(page.getByText("Periset · Lounge")).toBeVisible();
  });

  test("F31-H3 pilih penampilan: saring, pilih, tersimpan, dan dipakai lagi saat diubah", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").fill("Laila");
    await field(page, "Jabatan").fill("Penulis caption");
    const picker = page.getByRole("group", { name: "Penampilan" });
    await expect(picker.getByText("Pratinjau di Studio Naskah")).toBeVisible();
    await expect(picker.getByText("Belum dipilih: karakter dipilihkan otomatis saat disimpan.")).toBeVisible();

    await picker.getByRole("button", { name: "Berhijab" }).click();
    await expect(picker.getByRole("button", { name: "Berhijab" })).toHaveAttribute("aria-pressed", "true");
    await expect(picker.getByText("Kemeja navy", { exact: false })).toBeHidden();
    await picker.getByText("Hijab biru muda, tablet").click();
    await expect(picker.getByRole("radio", { name: "Hijab biru muda, tablet" })).toBeChecked();
    await expect(picker.getByRole("img", { name: "Pratinjau: Hijab biru muda, tablet, di Studio Naskah" })).toBeVisible();
    await expectA11y(page, "S14 agent baru, pilih penampilan");
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Laila sudah bergabung")).toBeVisible();

    const [a] = await sql`select id, appearance from public.agents where office_id = ${f.officeId} and name = 'Laila'`;
    expect(a.appearance).toBe("c11");
    await page.goto(`/o/${f.slug}/agent/${a.id}`);
    await expect(page.getByRole("radio", { name: "Hijab biru muda, tablet" })).toBeChecked();
    await page.getByRole("button", { name: "Acak" }).click();
    await expect(page.getByRole("radio", { name: "Hijab biru muda, tablet" })).not.toBeChecked();
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent$`));
    const [b] = await sql`select appearance from public.agents where id = ${a.id}`;
    expect(b.appearance).toMatch(/^c(0[1-9]|1[0-2])$/);
    expect(b.appearance).not.toBe("c11");
  });

  test("F31-H4 tanpa memilih: tersimpan kosong, denah memakai karakter tetap", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").fill("Gilang");
    await field(page, "Jabatan").fill("Editor video");
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Gilang sudah bergabung")).toBeVisible();
    const [a] = await sql`select appearance from public.agents where office_id = ${f.officeId} and name = 'Gilang'`;
    expect(a.appearance).toBeNull();
    await page.goto(`/o/${f.slug}`);
    await page.getByRole("button", { name: /^Gilang,/ }).click();
    await expect(page.getByText("Editor video · Studio Video")).toBeVisible();
  });

  test("F31-N1 nilai penampilan di luar 12 karakter ditolak server", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/agent/baru`);
    await field(page, "Nama").fill("Nekat");
    await field(page, "Jabatan").fill("Periset");
    const picker = page.getByRole("group", { name: "Penampilan" });
    await picker.getByText("Polo oranye").click();
    await picker.getByRole("radio", { name: "Polo oranye" }).evaluate((el: HTMLInputElement) => (el.value = "c99"));
    await page.getByRole("button", { name: "Buat agent" }).click();
    await expect(page.getByText("Pilih salah satu karakter.")).toBeVisible();
    const rows = await sql`select 1 from public.agents where office_id = ${f.officeId} and name = 'Nekat'`;
    expect(rows).toHaveLength(0);
  });
});
