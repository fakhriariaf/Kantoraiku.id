import { createHmac, randomBytes } from "node:crypto";
import { connector, createOffice, expect, expectA11y, login, setupCode, sql, test, visible } from "./helpers";

const text = (page: import("@playwright/test").Page, t: string | RegExp) => page.getByText(t).filter({ visible: true }).first();
const field = (page: import("@playwright/test").Page, label: string | RegExp) =>
  page.getByLabel(label, typeof label === "string" ? { exact: true } : undefined).filter({ visible: true }).first();

const INFO = [
  { title: "Jam buka", body: "Toko buka setiap hari pukul 09.00 sampai 21.00." },
  { title: "Ongkir", body: "Gratis ongkir untuk pembelian di atas Rp100.000." },
];

async function csOffice() {
  const f = await createOffice();
  const [a] = await sql`insert into public.agents (office_id, name, title, brain) values (${f.officeId}, 'CS Uji', 'Customer service', 'simulation') returning id`;
  for (const [i, it] of INFO.entries()) {
    await sql`insert into public.business_infos (office_id, title, body, position) values (${f.officeId}, ${it.title}, ${it.body}, ${i})`;
  }
  return { f, agentId: a.id as string };
}

test.describe("F08 CS WhatsApp", () => {
  test("F08-H1 info bisnis: tambah bagian, simpan, tetap ada setelah dibuka lagi", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs/info`);
    await expectA11y(page, "S27 info bisnis kosong");
    await field(page, "Judul").fill("Cara order");
    await field(page, "Isi").fill("Kirim nama barang dan alamat lewat chat ini.");
    await page.getByRole("button", { name: "Tambah bagian" }).click();
    await page.getByLabel("Judul").filter({ visible: true }).nth(1).fill("Retur");
    await page.getByLabel("Isi").filter({ visible: true }).nth(1).fill("Barang bisa ditukar dalam 3 hari.");
    await page.getByRole("button", { name: "Simpan info bisnis" }).click();
    await expect(text(page, "Info bisnis tersimpan")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Judul").filter({ visible: true }).nth(1)).toHaveValue("Retur");
    const rows = await sql`select title from public.business_infos where office_id = ${f.officeId} order by position`;
    expect(rows.map((r) => r.title)).toEqual(["Cara order", "Retur"]);
  });

  test("F08-H2 simulasi: pelanggan bertanya -> agent di PC menjawab dari info bisnis -> di luar info diserahkan ke kamu", async ({ page }) => {
    const { f } = await csOffice();
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs`);
    await expectA11y(page, "S25 CS kosong");
    await field(page, "Agent CS simulasi").selectOption({ label: "CS Uji" });
    await expect(text(page, "Agent CS tersimpan")).toBeVisible();

    await field(page, "Nama pelanggan").fill("Rina");
    await field(page, "Pesan pelanggan").fill("Kak, tokonya buka jam berapa?");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(page).toHaveURL(/\/cs\/[0-9a-f-]{36}$/);
    await expect(text(page, "Kak, tokonya buka jam berapa?")).toBeVisible();

    const out = await c.runOnce();
    expect(out.stdout).toContain("CS Uji");
    await page.reload();
    await expect(text(page, /09\.00 sampai 21\.00/)).toBeVisible();
    await expectA11y(page, "S26 percakapan");

    await field(page, /Pesan baru dari Rina/).fill("Bisa bayar pakai kartu kredit?");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await c.runOnce();
    await page.reload();
    await expect(text(page, /teruskan ke tim/)).toBeVisible();
    await expect(text(page, "Kamu yang membalas")).toBeVisible();
    const [conv] = await sql`select handled_by, unread_count from public.cs_conversations where office_id = ${f.officeId}`;
    expect(conv.handled_by).toBe("human");
    const [act] = await sql`select text from public.activity_events where office_id = ${f.officeId} and kind = 'cs.handoff'`;
    expect(act.text).toContain("Rina");
  });

  test("F08-H3 ambil alih, balas sendiri, lalu serahkan lagi: agent menjawab pesan yang tertunda", async ({ page }) => {
    const { f } = await csOffice();
    const c = connector();
    await c.pair(await setupCode(f.officeId));
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs`);
    await field(page, "Agent CS simulasi").selectOption({ label: "CS Uji" });
    await expect(text(page, "Agent CS tersimpan")).toBeVisible();
    await field(page, "Pesan pelanggan").fill("Halo, ongkirnya berapa?");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(page).toHaveURL(/\/cs\/[0-9a-f-]{36}$/);

    await visible(page, "button", "Ambil alih").click();
    await expect(text(page, "Kamu yang membalas sekarang")).toBeVisible();
    await c.runOnce(); // run yang sudah antre: balasan agent tidak dikirim karena sudah diambil alih
    await field(page, /Balas sebagai kamu/).fill("Halo! Ongkir gratis di atas Rp100.000 ya.");
    await page.getByRole("button", { name: "Kirim", exact: true }).click();
    await expect(text(page, "Halo! Ongkir gratis di atas Rp100.000 ya.")).toBeVisible();
    const outs = await sql`select sent_by, status from public.cs_messages where direction = 'out' and office_id = ${f.officeId}`;
    expect(outs).toEqual([{ sent_by: "human", status: "sent" }]);

    await field(page, /Pesan baru dari/).fill("Kalau jam buka?");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(text(page, "Kalau jam buka?")).toBeVisible();
    await visible(page, "button", "Serahkan ke agent").click();
    await expect(text(page, "Agent CS membalas lagi")).toBeVisible();
    await c.runOnce();
    await page.reload();
    await expect(text(page, /09\.00 sampai 21\.00/)).toBeVisible();
  });

  test("F08-E1 pesan beruntun: satu balasan untuk semuanya", async ({ page }) => {
    const { f, agentId } = await csOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs`);
    await field(page, "Agent CS simulasi").selectOption({ label: "CS Uji" });
    await expect(text(page, "Agent CS tersimpan")).toBeVisible();
    await field(page, "Pesan pelanggan").fill("Halo");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(page).toHaveURL(/\/cs\/[0-9a-f-]{36}$/);
    await field(page, /Pesan baru dari/).fill("Masih buka?");
    await page.getByRole("button", { name: "Kirim sebagai pelanggan" }).click();
    await expect(text(page, "Masih buka?")).toBeVisible();
    const runs = await sql`select count(*)::int as n from public.task_runs where agent_id = ${agentId} and status = 'queued'`;
    expect(runs[0].n).toBe(1);
  });

  test("F08-N1 webhook Cloud API: verifikasi, tanda tangan, idempoten, status maju", async ({ page }) => {
    const { f } = await csOffice();
    const phoneId = `uji-${randomBytes(4).toString("hex")}`;
    const [conn] = await sql`insert into public.wa_connections (office_id, mode, waba_id, phone_number_id, display_phone, status)
      values (${f.officeId}, 'cloud', 'waba-uji', ${phoneId}, '+62 811-0000-0000', 'active') returning id`;

    const verify = await page.request.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=12345`);
    expect(verify.status()).toBe(200);
    expect(await verify.text()).toBe("12345");
    expect((await page.request.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=1`)).status()).toBe(403);

    const msgId = `wamid.${randomBytes(6).toString("hex")}`;
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "waba-uji", changes: [{ field: "messages", value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: "628110000000", phone_number_id: phoneId },
        contacts: [{ profile: { name: "Budi" }, wa_id: "6281234567890" }],
        messages: [{ from: "6281234567890", id: msgId, timestamp: "1700000000", type: "text", text: { body: "Halo dari WhatsApp" } }],
      } }] }],
    });
    const sign = (body: string) => `sha256=${createHmac("sha256", process.env.WHATSAPP_APP_SECRET!).update(body).digest("hex")}`;
    const post = (body: string, sig: string) => page.request.post("/api/webhooks/whatsapp", { headers: { "content-type": "application/json", "x-hub-signature-256": sig }, data: body });

    expect((await post(payload, "sha256=salah")).status()).toBe(401);
    expect((await post(payload, sign(payload))).status()).toBe(200);
    expect((await post(payload, sign(payload))).status()).toBe(200); // dikirim ulang oleh Meta
    const msgs = await sql`select m.body, c.customer_name from public.cs_messages m join public.cs_conversations c on c.id = m.conversation_id where c.wa_connection_id = ${conn.id}`;
    expect(msgs).toEqual([{ body: "Halo dari WhatsApp", customer_name: "Budi" }]);

    // Status kirim hanya maju: "read" lalu "delivered" yang telat datang tidak menurunkan status.
    const [conv] = await sql`select id from public.cs_conversations where wa_connection_id = ${conn.id}`;
    const outId = `wamid.${randomBytes(6).toString("hex")}`;
    await sql`insert into public.cs_messages (office_id, conversation_id, direction, wa_message_id, body, status, sent_by) values (${f.officeId}, ${conv.id}, 'out', ${outId}, 'Balasan', 'sent', 'human')`;
    const status = (s: string) => JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: phoneId }, statuses: [{ id: outId, status: s }] } }] }] });
    for (const s of ["read", "delivered"]) await post(status(s), sign(status(s)));
    const [st] = await sql`select status from public.cs_messages where wa_message_id = ${outId}`;
    expect(st.status).toBe("read");

    await login(page, f);
    await page.goto(`/o/${f.slug}/cs`);
    await expect(text(page, "+62 811-0000-0000")).toBeVisible();
    await expect(visible(page, "link", /Budi/)).toBeVisible();
  });

  test("F08-N2 percakapan kantor lain tidak bisa dibuka; HP 390px tanpa scroll horizontal", async ({ page }) => {
    const other = await csOffice();
    const [conn] = await sql`insert into public.wa_connections (office_id, mode, waba_id, phone_number_id, display_phone, status)
      values (${other.f.officeId}, 'simulation', 'simulasi', ${"sim-" + other.f.officeId}, 'Simulasi', 'active') returning id`;
    const [conv] = await sql`insert into public.cs_conversations (office_id, wa_connection_id, customer_wa_id, customer_name) values (${other.f.officeId}, ${conn.id}, 'sim-rahasia', 'Rahasia') returning id`;

    const { f } = await csOffice();
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, f);
    await page.goto(`/o/${f.slug}/cs/${conv.id}`);
    await expect(page.getByText(/could not be found|tidak ditemukan/i).first()).toBeVisible();
    await expect(page.getByText("Rahasia")).toHaveCount(0);

    for (const path of ["/cs", "/cs/info"]) {
      await page.goto(`/o/${f.slug}${path}`);
      await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    await expectA11y(page, "S27 390px");
  });
});
