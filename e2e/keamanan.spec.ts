import { addContentSetup, connector, createOffice, expect, login, queueRun, setupCode, sql, test } from "./helpers";

test.describe("Keamanan lintas flow", () => {
  test("SEC-1/2 user kedua tidak bisa melihat kantor atau data user pertama", async ({ page }) => {
    const a = await createOffice();
    const s = await addContentSetup(a.officeId);
    const c = connector();
    await c.pair(await setupCode(a.officeId));
    await queueRun(a.officeId, s.researchTaskId);
    await c.runOnce();
    const [content] = await sql`select id from public.contents where office_id = ${a.officeId}`;

    const b = await createOffice();
    await login(page, b);
    await page.goto(`/o/${a.slug}`);
    await expect(page).toHaveURL(new RegExp(`/o/${a.slug}/masuk\\?e=bukan-anggota$`));
    await expect(page.getByText(/Periset Uji|Fakta Uji/)).toHaveCount(0);
    for (const path of [`/o/${b.slug}/konten/${content.id}`, `/o/${b.slug}/agent/${s.researcherId}`]) {
      await page.goto(path);
      await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
      await expect(page.getByText(/Kenapa langit|Periset Uji/)).toHaveCount(0);
    }
  });

  test("SEC-3 API perangkat tanpa token / token palsu -> 401", async ({ request }) => {
    for (const auth of [undefined, "Bearer palsu"]) {
      const r = await request.post("/api/device/runs/claim", { headers: auth ? { authorization: auth } : {}, data: {} });
      expect(r.status()).toBe(401);
    }
  });

  test("SEC-4 perangkat kantor B tidak bisa melapor run kantor A", async ({ request }) => {
    const a = await createOffice();
    const s = await addContentSetup(a.officeId);
    const runId = await queueRun(a.officeId, s.researchTaskId);
    const b = await createOffice();
    const pb = await request.post("/api/device/pair", {
      data: { setupCode: await setupCode(b.officeId), kind: "pc_windows", name: "PC B", publicKey: "A".repeat(44), version: "e2e" },
    });
    const { deviceToken } = await pb.json();
    const h = { authorization: `Bearer ${deviceToken}` };
    const claim = await request.post("/api/device/runs/claim", { headers: h, data: {} });
    expect(claim.status()).toBe(204); // tidak ada kerja milik kantor B
    const done = await request.post(`/api/device/runs/${runId}/complete`, { headers: h, data: { status: "succeeded", output: { topics: [] } } });
    expect(done.status()).toBe(404);
    const [r] = await sql`select status from public.task_runs where id = ${runId}`;
    expect(r.status).toBe("queued");
  });

  test("SEC-5 cookie sesi httpOnly (tidak terbaca JavaScript)", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    const fromJs = await page.evaluate(() => document.cookie);
    expect(fromJs).not.toMatch(/sb-.*auth-token/);
    const cookies = await page.context().cookies();
    const session = cookies.filter((c) => /^sb-.*auth-token/.test(c.name));
    expect(session.length).toBeGreaterThan(0);
    for (const c of session) expect(c.httpOnly).toBe(true);
  });

  test("SEC-6 data pembayaran dummy tidak bocor ke halaman publik production (cek peringatan dev ada)", async ({ page }) => {
    await page.goto("/beli");
    await expect(page.getByText(/DUMMY/)).toHaveCount(0);
  });
});
