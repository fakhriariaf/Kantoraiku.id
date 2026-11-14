import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addContentSetup, connector, createOffice, expect, expectA11y, login, queueRun, setupCode, sql, test, visible } from "./helpers";

const field = (page: import("@playwright/test").Page, label: string | RegExp) =>
  page.getByLabel(label, typeof label === "string" ? { exact: true } : undefined).filter({ visible: true }).first();

async function newSkill(page: import("@playwright/test").Page, slug: string, name: string, body = "Buka dengan pertanyaan yang bikin penasaran.") {
  await page.goto(`/o/${slug}/skill/baru`);
  await field(page, "Nama skill").fill(name);
  await field(page, /^Deskripsi singkat/).fill("Untuk pembuka video");
  await field(page, "Instruksi").fill(body);
  await page.getByRole("button", { name: "Buat skill" }).click();
  await expect(page).toHaveURL(/\/skill\?baru=/);
}

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();

test.describe("S15 skill", () => {
  test("S15-H1 kosong -> buat skill -> muncul di daftar dengan slug stabil", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/skill`);
    await expect(text(page, "Belum ada skill")).toBeVisible();
    await expectA11y(page, "S15 kosong");

    await page.getByRole("link", { name: "Buat skill pertama" }).click();
    await expectA11y(page, "S15 skill baru");
    await newSkill(page, f.slug, "Hook 3 Detik!");
    await expect(text(page, 'Skill "Hook 3 Detik!" dibuat')).toBeVisible();
    await expect(visible(page, "heading", "Hook 3 Detik!")).toBeVisible();
    await expect(text(page, "Belum dipasang")).toBeVisible();
    await expectA11y(page, "S15 daftar");
    const [s] = await sql`select slug from public.skills where office_id = ${f.officeId}`;
    expect(s.slug).toBe("hook-3-detik");
  });

  test("S15-E1 nama dobel ditolak, isian tetap; instruksi kosong ditolak", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await newSkill(page, f.slug, "Gaya santai");

    await page.goto(`/o/${f.slug}/skill/baru`);
    await field(page, "Nama skill").fill("gaya SANTAI");
    await field(page, "Instruksi").fill("Instruksi panjang yang tidak boleh hilang.");
    await page.getByRole("button", { name: "Buat skill" }).click();
    await expect(text(page, "Sudah ada skill dengan nama ini.")).toBeVisible();
    await expect(field(page, "Instruksi")).toHaveValue("Instruksi panjang yang tidak boleh hilang.");

    await field(page, "Nama skill").fill("Skill lain");
    await field(page, "Instruksi").evaluate((el: HTMLTextAreaElement) => el.removeAttribute("required"));
    await field(page, "Instruksi").fill("   ");
    await page.getByRole("button", { name: "Buat skill" }).click();
    await expect(text(page, "Tulis instruksi skill.")).toBeVisible();
  });

  test("S15-H2 pasang ke agent -> chip di kartu, isi skill sampai ke konektor", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);
    await newSkill(page, f.slug, "Sumber tepercaya", "Pakai hanya sumber berita resmi atau jurnal.");

    await page.goto(`/o/${f.slug}/agent/${s.researcherId}`);
    await page.getByRole("checkbox", { name: /Sumber tepercaya/ }).check();
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent$`));
    await expect(page.getByText("Sumber tepercaya").filter({ visible: true }).first()).toBeVisible();

    await page.goto(`/o/${f.slug}/skill`);
    await expect(text(page, "Dipakai 1 agent")).toBeVisible();

    // Paket kerja yang diterima konektor memuat isi skill.
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    const { deviceToken } = JSON.parse(readFileSync(join(c.dir, "connector.json"), "utf8"));
    await queueRun(f.officeId, s.researchTaskId);
    const res = await page.request.post("/api/device/runs/claim", { headers: { authorization: `Bearer ${deviceToken}` }, data: {} });
    expect(res.ok()).toBe(true);
    const pkg = await res.json();
    expect(pkg.skills).toEqual([{ slug: "sumber-tepercaya", name: "Sumber tepercaya", body: "Pakai hanya sumber berita resmi atau jurnal." }]);
  });

  test("S15-H3 ubah lalu hapus skill: dilepas dari agent", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);
    await newSkill(page, f.slug, "Nada lucu");
    const [sk] = await sql`select id from public.skills where office_id = ${f.officeId}`;
    await sql`insert into public.agent_skills (office_id, agent_id, skill_id) values (${f.officeId}, ${s.writerId}, ${sk.id})`;

    await page.goto(`/o/${f.slug}/skill/${sk.id}`);
    await expect(page.getByRole("link", { name: "Penulis Uji" })).toBeVisible();
    await field(page, "Nama skill").fill("Nada lucu dan ringan");
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(text(page, 'Perubahan "Nada lucu dan ringan" tersimpan')).toBeVisible();
    const [after] = await sql`select slug from public.skills where id = ${sk.id}`;
    expect(after.slug).toBe("nada-lucu"); // slug tetap: jadi nama file skill di PC

    await page.goto(`/o/${f.slug}/skill/${sk.id}`);
    await page.getByRole("button", { name: "Hapus skill" }).click();
    await expectA11y(page, "S15 dialog hapus");
    await page.getByRole("button", { name: "Ya, hapus" }).click();
    await expect(text(page, "Skill sudah dilepas dari semua agent.")).toBeVisible();
    const left = await sql`select 1 from public.agent_skills where agent_id = ${s.writerId}`;
    expect(left.length).toBe(0);
  });

  test("S15-N1 skill kantor lain: 404, dan id asingnya diabaikan saat disimpan ke agent", async ({ page }) => {
    const other = await createOffice();
    const [foreign] = await sql`insert into public.skills (office_id, slug, name, body_md) values (${other.officeId}, 'rahasia', 'Rahasia', 'x') returning id`;
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await login(page, f);

    await page.goto(`/o/${f.slug}/skill/${foreign.id}`);
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
    await expect(page.getByText("Rahasia")).toHaveCount(0);

    await newSkill(page, f.slug, "Milik sendiri");
    await page.goto(`/o/${f.slug}/agent/${s.researcherId}`);
    // Sisipkan checkbox dengan id skill kantor lain: server harus mengabaikannya.
    await page.locator("form").filter({ visible: true }).first().evaluate((form, id) => {
      const el = document.createElement("input");
      el.type = "checkbox";
      el.name = "skills";
      el.value = id;
      el.checked = true;
      el.hidden = true;
      form.appendChild(el);
    }, foreign.id as string);
    await page.getByRole("checkbox", { name: /Milik sendiri/ }).check();
    await page.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/agent$`));
    const rows = await sql`select s.name from public.agent_skills x join public.skills s on s.id = x.skill_id where x.agent_id = ${s.researcherId}`;
    expect(rows.map((r) => r.name)).toEqual(["Milik sendiri"]);
  });

  test("S15-E2 lebar HP 390px: daftar dan form tanpa scroll horizontal", async ({ page }) => {
    const f = await createOffice();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    await newSkill(page, f.slug, "N".repeat(60));
    for (const path of ["/skill", "/skill/baru"]) {
      await page.goto(`/o/${f.slug}${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await expectA11y(page, "S15 form 390px");
  });
});
