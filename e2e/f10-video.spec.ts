import { existsSync } from "node:fs";
import { addContentSetup, connector, createOffice, expect, expectA11y, login, queueRun, setupCode, sql, test, visible } from "./helpers";

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();

/** Kantor: riset -> naskah (manual) -> video setelah naskah, dikerjakan konektor sungguhan. */
async function officeWithVideoTask(mode: "manual" | "auto" = "manual") {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId, mode);
  const [a] = await sql`insert into public.agents (office_id, name, title, brain) values (${f.officeId}, 'Editor Uji', 'Editor video', 'simulation') returning id`;
  const [t] = await sql`insert into public.tasks (office_id, agent_id, channel_id, name, kind, trigger, after_task_id, required_capability)
    values (${f.officeId}, ${a.id}, ${s.channelId}, 'Video uji', 'video', 'after_task', ${s.scriptTaskId}, 'video') returning id`;
  const c = connector();
  await c.pair(await setupCode(f.officeId));
  return { f, s, c, videoTaskId: t.id as string };
}

test.describe("F10 video di PC", () => {
  test("F10-H1 naskah disetujui -> video dirender di PC -> cover di dashboard -> video disetujui", async ({ page }) => {
    const { f, s, c } = await officeWithVideoTask();
    await queueRun(f.officeId, s.researchTaskId);
    await c.runOnce(); // riset + naskah
    const [content] = await sql`select id from public.contents where office_id = ${f.officeId}`;

    await login(page, f);
    await page.goto(`/o/${f.slug}/konten/${content.id}`);
    await visible(page, "button", "Setujui").click();
    await expect(text(page, "Naskah disetujui")).toBeVisible();

    const out = await c.runOnce(); // video
    expect(out.stdout).toContain("video tersimpan di PC");
    const [v] = await sql`select stage, video_local_ref, cover_path, duration_s from public.contents where id = ${content.id}`;
    expect(v.stage).toBe("video_review");
    expect(existsSync(v.video_local_ref)).toBe(true);
    expect(v.video_local_ref).toContain(c.dir);
    expect(v.cover_path).toBe(`${f.officeId}/${content.id}.jpg`);

    await page.goto(`/o/${f.slug}/persetujuan`);
    await expect(text(page, "Video menunggu kamu")).toBeVisible();
    await page.goto(`/o/${f.slug}/konten/${content.id}`);
    await expect(page.getByRole("img", { name: /Cover video/ }).filter({ visible: true })).toBeVisible();
    await expect(text(page, "Video tidak diunggah ke server")).toBeVisible();
    await expect(text(page, /Simulasi \(tanpa suara\)/)).toBeVisible();
    await expectA11y(page, "S22 video menunggu persetujuan");
    // Gambar cover benar-benar bisa dimuat dari bucket privat.
    const loaded = await page.getByRole("img", { name: /Cover video/ }).filter({ visible: true }).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);

    await visible(page, "button", "Setujui").click();
    await expect(text(page, "Video disetujui")).toBeVisible();
    const [done] = await sql`select stage from public.contents where id = ${content.id}`;
    expect(done.stage).toBe("video_approved");
  });

  test("F10-H2 revisi video: dirender ulang, revisi naik", async ({ page }) => {
    const { f, s, c } = await officeWithVideoTask();
    await queueRun(f.officeId, s.researchTaskId);
    await c.runOnce();
    const [content] = await sql`select id from public.contents where office_id = ${f.officeId}`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/konten/${content.id}`);
    await visible(page, "button", "Setujui").click();
    await expect(text(page, "Naskah disetujui")).toBeVisible();
    await c.runOnce();

    await page.goto(`/o/${f.slug}/konten/${content.id}`);
    await visible(page, "button", "Revisi").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Catatan revisi").fill("Ganti footage pembuka.");
    await dialog.getByRole("button", { name: "Kirim revisi" }).click();
    await expect(text(page, "Video dibuat ulang")).toBeVisible();

    await c.runOnce();
    const [r] = await sql`select stage, revision, video_local_ref from public.contents where id = ${content.id}`;
    expect(r.stage).toBe("video_review");
    expect(r.revision).toBe(1);
    expect(r.video_local_ref).toMatch(/-r1\.mp4$/);
  });

  test("F10-N1 tugas video tanpa naskah disetujui: gagal dengan pesan jelas", async ({ page }) => {
    const { f, c, videoTaskId } = await officeWithVideoTask();
    await queueRun(f.officeId, videoTaskId);
    const out = await c.runOnce();
    expect(out.stdout).toContain("Setujui naskah dulu");
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await expect(text(page, /Setujui naskah dulu/)).toBeVisible();
  });

  test("F10-N2 cover: hanya JPEG kecil dari perangkat yang merender konten itu", async ({ page }) => {
    const { f, s, c } = await officeWithVideoTask("auto");
    await queueRun(f.officeId, s.researchTaskId);
    await c.runOnce();
    const [content] = await sql`select id from public.contents where office_id = ${f.officeId}`;
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { deviceToken } = JSON.parse(readFileSync(join(c.dir, "connector.json"), "utf8"));
    const post = (id: string, body: Buffer, type = "image/jpeg", token = deviceToken) =>
      page.request.post(`/api/device/contents/${id}/cover`, { headers: { authorization: `Bearer ${token}`, "content-type": type }, data: body });

    expect((await post(content.id, Buffer.from("bukan jpeg"))).status()).toBe(415);
    expect((await post(content.id, Buffer.alloc(201 * 1024, 0xff))).status()).toBe(413);
    expect((await post(content.id, Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/png")).status()).toBe(415);

    // Perangkat kantor lain tidak bisa menimpa cover konten ini.
    const other = await officeWithVideoTask();
    const { deviceToken: otherToken } = JSON.parse(readFileSync(join(other.c.dir, "connector.json"), "utf8"));
    expect((await post(content.id, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]), "image/jpeg", otherToken)).status()).toBe(404);
  });

  test("F10-E1 form tugas: jenis video tersedia dengan penjelasan kunci", async ({ page }) => {
    const f = await createOffice();
    await addContentSetup(f.officeId);
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await page.getByLabel("Jenis tugas").filter({ visible: true }).first().selectOption("video");
    await expect(text(page, /PEXELS_API_KEY/)).toBeVisible();
    await expectA11y(page, "S16 tugas video");
  });
});
