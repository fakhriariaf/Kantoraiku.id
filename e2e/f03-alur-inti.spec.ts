import { addContentSetup, connector, createOffice, expect, expectA11y, login, queueRun, setupCode, sql, test, visible, type OfficeFixture } from "./helpers";

/** Kantor dengan PC terpasang + satu naskah menunggu persetujuan (lewat konektor sungguhan). */
async function officeWithPendingScript(mode: "manual" | "auto" = "manual") {
  const f = await createOffice();
  const s = await addContentSetup(f.officeId, mode);
  const c = connector();
  await c.pair(await setupCode(f.officeId));
  await queueRun(f.officeId, s.researchTaskId);
  const out = await c.runOnce();
  expect(out.stdout).toContain("Periset Uji");
  expect(out.stdout).toContain("Penulis Uji");
  const [content] = await sql`select id, stage from public.contents where office_id = ${f.officeId}`;
  return { f, s, c, contentId: content.id as string, stage: content.stage as string };
}

const openContent = async (page: import("@playwright/test").Page, f: OfficeFixture, id: string) => {
  await page.goto(`/o/${f.slug}/konten/${id}`);
  await expect(visible(page, "heading", /./)).toBeVisible();
};

test.describe("F03 satu konten, mode manual", () => {
  test("F03-H1 riset -> rantai -> naskah -> persetujuan -> setujui", async ({ page }) => {
    const { f, contentId, stage } = await officeWithPendingScript();
    expect(stage).toBe("script_review");
    await login(page, f);
    await expect(page.getByText("1 naskah menunggu persetujuanmu")).toBeVisible();
    await expectA11y(page, "S11 beranda");
    // Alamat lama Persetujuan dialihkan ke Konten, tab Perlu keputusan.
    await page.goto(`/o/${f.slug}/persetujuan`);
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/konten$`));
    await expectA11y(page, "S21 konten: perlu keputusan");
    await visible(page, "link", /Kenapa langit sore/).click();
    await expect(page).toHaveURL(new RegExp(`/konten\\?pilih=${contentId}$`));
    await expect(page.getByRole("complementary", { name: "Detail" }).getByRole("heading", { name: /Kenapa langit sore/ })).toBeVisible();
    await expectA11y(page, "S22 detail konten di panel");
    await visible(page, "button", "Setujui").click();
    await expect(page.getByText("Naskah disetujui").filter({ visible: true }).first()).toBeVisible();
    const [c] = await sql`select stage from public.contents where id = ${contentId}`;
    expect(c.stage).toBe("script_approved");
    await page.goto(`/o/${f.slug}/persetujuan`);
    await expect(page.getByText("Tidak ada yang menunggu kamu").filter({ visible: true }).first()).toBeVisible();
  });

  test("F03-E3 klik dobel Setujui: satu keputusan", async ({ page }) => {
    const { f, contentId } = await officeWithPendingScript();
    await login(page, f);
    await openContent(page, f, contentId);
    await visible(page, "button", "Setujui").dblclick();
    await expect(page.getByText("Naskah disetujui").filter({ visible: true }).first()).toBeVisible();
    const [{ n }] = await sql`select count(*)::int as n from public.approvals where content_id = ${contentId} and decision is not null`;
    expect(n).toBe(1);
  });

  test("F03-E4 dua tab memutuskan bersamaan: satu menang, satu diberi tahu", async ({ page, browser }) => {
    const { f, contentId } = await officeWithPendingScript();
    await login(page, f);
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await login(p2, f);
    await openContent(page, f, contentId);
    await openContent(p2, f, contentId);
    await visible(page, "button", "Setujui").click();
    await expect(page.getByText("Naskah disetujui").filter({ visible: true }).first()).toBeVisible();
    await visible(p2, "button", "Tolak").click();
    await expect(p2.getByText("Sudah diputuskan sebelumnya.", { exact: true })).toBeVisible();
    await ctx.close();
    const rows = await sql`select decision from public.approvals where content_id = ${contentId} and decision is not null`;
    expect(rows.map((r) => r.decision)).toEqual(["approve"]);
  });

  test("F03-E5 sesi habis lalu klik Setujui: diarahkan ke login, tidak ada keputusan", async ({ page }) => {
    const { f, contentId } = await officeWithPendingScript();
    await login(page, f);
    await openContent(page, f, contentId);
    await page.context().clearCookies();
    await visible(page, "button", "Setujui").click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/masuk`));
    const [{ n }] = await sql`select count(*)::int as n from public.approvals where content_id = ${contentId} and decision is not null`;
    expect(n).toBe(0);
  });

  test("F03-E6 HP 390px: bar persetujuan terlihat dan tidak tertutup bottom nav", async ({ page }) => {
    const { f, contentId } = await officeWithPendingScript();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    await openContent(page, f, contentId);
    const approve = visible(page, "button", "Setujui");
    await expect(approve).toBeInViewport();
    const bar = await approve.boundingBox();
    const nav = await page.getByRole("navigation", { name: "Menu kantor" }).filter({ visible: true }).boundingBox();
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(nav!.y);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
    await expectA11y(page, "S22 HP");
  });

  test("F03-E7 hanya keyboard: setujui naskah", async ({ page }) => {
    const { f, contentId } = await officeWithPendingScript();
    await login(page, f);
    await openContent(page, f, contentId);
    await visible(page, "button", "Setujui").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Naskah disetujui").filter({ visible: true }).first()).toBeVisible();
  });

  test("F03-E1 PC mati: tugas menunggu dan beranda memberi tahu", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    await connector().pair(await setupCode(f.officeId));
    await sql`update public.devices set status = 'offline' where office_id = ${f.officeId}`;
    await queueRun(f.officeId, s.researchTaskId);
    await login(page, f);
    await expect(page.getByText("PC kamu offline")).toBeVisible();
    await expect(page.getByText("1 tugas menunggu dan jalan begitu PC menyala lagi.")).toBeVisible();
  });

  test("F03-N1 otak OpenAI tanpa kunci: run gagal dengan pesan jelas", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId, "manual", "openai");
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await queueRun(f.officeId, s.researchTaskId);
    const out = await c.runOnce();
    expect(out.stdout).toContain("OPENAI_API_KEY belum diisi");
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await expect(page.getByText(/OPENAI_API_KEY belum diisi/).filter({ visible: true }).first()).toBeVisible();
    await page.goto(`/o/${f.slug}/agent`);
    await expect(page.getByText("Bermasalah").filter({ visible: true }).first()).toBeVisible();
  });

  test("F03-N2 otak Claude tanpa kunci: run gagal dengan pesan jelas, status kunci tampil di Perangkat", async ({ page }) => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId, "manual", "claude");
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await queueRun(f.officeId, s.researchTaskId);
    const out = await c.runOnce();
    expect(out.stdout).toContain("ANTHROPIC_API_KEY belum diisi");
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await expect(page.getByText(/ANTHROPIC_API_KEY belum diisi/).filter({ visible: true }).first()).toBeVisible();
    await page.goto(`/o/${f.slug}/perangkat`);
    await expect(page.getByText("Claude: belum ada kunci").filter({ visible: true }).first()).toBeVisible();
  });

  test("F03-E9 jaringan putus saat klik Jalankan: pesan error, halaman tidak rusak", async ({ page, guard }) => {
    guard.allowConsole.push(/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED|net::/i);
    const f = await createOffice();
    await addContentSetup(f.officeId);
    await login(page, f);
    await page.goto(`/o/${f.slug}/tugas`);
    await page.context().setOffline(true);
    await visible(page, "button", "Jalankan").click();
    await expect(page.getByText(/Gagal|koneksi/i).filter({ visible: true }).first()).toBeVisible();
    await page.context().setOffline(false);
    await expect(page.getByRole("heading", { name: "Tugas", exact: true })).toBeVisible();
  });
});

test.describe("F04 revisi dan tolak", () => {
  test("F04-N1 revisi tanpa catatan ditolak; F04-H1 revisi dengan catatan -> revisi 1", async ({ page }) => {
    const { f, c, contentId } = await officeWithPendingScript();
    await login(page, f);
    await openContent(page, f, contentId);
    await visible(page, "button", "Revisi").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Kirim revisi" }).click();
    await expect(dialog.getByText("Catatan revisi wajib diisi.")).toBeVisible();
    await expectA11y(page, "dialog revisi");
    await dialog.getByLabel("Catatan revisi").fill("Pembukanya kurang kuat, mulai dengan pertanyaan.");
    await dialog.getByRole("button", { name: "Kirim revisi" }).click();
    await expect(page.getByText("Revisi dikirim ke agent").filter({ visible: true }).first()).toBeVisible();

    const out = await c.runOnce();
    expect(out.stdout).toContain("Penulis Uji");
    await page.reload();
    await expect(page.getByText(/revisi 1/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Pembukanya kurang kuat, mulai dengan pertanyaan.").filter({ visible: true }).first()).toBeVisible();
    const [row] = await sql`select stage, revision from public.contents where id = ${contentId}`;
    expect(row).toMatchObject({ stage: "script_review", revision: 1 });
  });

  test("F04-H2 tolak naskah", async ({ page }) => {
    const { f, contentId } = await officeWithPendingScript();
    await login(page, f);
    await openContent(page, f, contentId);
    await visible(page, "button", "Tolak").click();
    await expect(page.getByText("Naskah ditolak").filter({ visible: true }).first()).toBeVisible();
    const [row] = await sql`select stage from public.contents where id = ${contentId}`;
    expect(row.stage).toBe("rejected");
  });
});

test.describe("F05 mode otomatis", () => {
  test("F05-H1 channel otomatis: naskah langsung disetujui tanpa antre persetujuan", async () => {
    const { f, stage } = await officeWithPendingScript("auto");
    expect(stage).toBe("script_approved");
    const [{ n }] = await sql`select count(*)::int as n from public.approvals where office_id = ${f.officeId}`;
    expect(n).toBe(0);
  });

  test("F05-E1 ganti ke manual lewat UI: naskah berikutnya menunggu persetujuan", async ({ page }) => {
    const { f, s, c } = await officeWithPendingScript("auto");
    await login(page, f);
    await page.goto(`/o/${f.slug}/channel`);
    await expectA11y(page, "S17 channel");
    await page.getByRole("radio", { name: "Manual" }).filter({ visible: true }).first().click();
    await expect(page.getByText("Mode manual aktif").filter({ visible: true }).first()).toBeVisible();
    await queueRun(f.officeId, s.researchTaskId);
    await c.runOnce();
    const [{ n }] = await sql`select count(*)::int as n from public.approvals where office_id = ${f.officeId} and decision is null`;
    expect(n).toBe(1);
  });
});
