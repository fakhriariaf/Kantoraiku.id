import { createOffice, expect, expectA11y, login, sql, test } from "./helpers";

type Page = import("@playwright/test").Page;

const chat = (page: Page) => page.getByRole("log", { name: "Percakapan dengan Asisten" });

async function say(page: Page, text: string) {
  await page.getByLabel("Pesan untuk Asisten").fill(text);
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByLabel("Pesan untuk Asisten")).toHaveValue("");
}

async function reply(page: Page, label: string) {
  await chat(page).getByRole("group", { name: "Balasan cepat" }).getByRole("button", { name: label }).click();
}

const proposal = (page: Page, title: string) => chat(page).getByRole("region", { name: `Usulan: ${title}` });

test.describe("F02 asisten setup", () => {
  test("F02-H3 setup lewat chat: channel, periset, penulis, skill, tugas berantai, jalankan", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.getByRole("navigation", { name: "Menu kantor" }).first().getByRole("link", { name: "Asisten" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/asisten$`));
    await expect(chat(page).getByText("Halo, aku Asisten.")).toBeVisible();
    await expectA11y(page, "S28 asisten, pertama kali");

    await reply(page, "Mulai setup");
    await expect(chat(page).getByText("Pertama, sambungkan PC kamu.")).toBeVisible();
    await expect(chat(page).getByRole("link", { name: "Buka Perangkat" })).toHaveAttribute("href", `/o/${f.slug}/perangkat`);
    await reply(page, "Lewati dulu");

    await expect(chat(page).getByText("Apa nama channel kamu?")).toBeVisible();
    await say(page, "Resep 10 Menit");
    await expect(chat(page).getByText("Topiknya tentang apa?")).toBeVisible();
    await say(page, "Resep cepat untuk anak kos, bahan murah.");
    await proposal(page, "Buat channel").getByRole("button", { name: "Buat channel" }).click();
    await expect(chat(page).getByText("Channel Resep 10 Menit sudah dibuat.")).toBeVisible();

    // Periset: ganti nama dengan mengetik.
    await expect(proposal(page, "Buat agent").last()).toContainText("Periset tren");
    await say(page, "Rafi");
    await expect(chat(page).getByText("Buat agent: diganti usulan baru")).toBeVisible();
    const periset = proposal(page, "Buat agent").last();
    await expect(periset).toContainText("Rafi");
    await periset.getByRole("button", { name: "Buat agent" }).click();
    await expect(chat(page).getByText("Rafi sudah bergabung sebagai Periset tren.")).toBeVisible();

    const penulis = proposal(page, "Buat agent").last();
    await expect(penulis).toContainText("Penulis naskah");
    await penulis.getByRole("button", { name: "Buat agent" }).click();
    await expect(chat(page).getByText(/sudah bergabung sebagai Penulis naskah\./)).toBeVisible();

    await proposal(page, "Buat skill").getByRole("button", { name: "Buat skill" }).click();
    await expect(chat(page).getByText(/Skill Gaya Resep 10 Menit sudah dibuat dan dipasang ke/)).toBeVisible();

    await proposal(page, "Buat tugas berantai").getByRole("button", { name: "Buat tugas" }).click();
    await expect(chat(page).getByText(/Tugas berantai dibuat: Rafi meriset tiap hari jam 08:00/)).toBeVisible();

    await proposal(page, "Jalankan sekarang").getByRole("button", { name: "Jalankan" }).click();
    await expect(chat(page).getByText("Riset Resep 10 Menit masuk antrean.", { exact: false })).toBeVisible();
    await expect(chat(page).getByText("Setup dasar kantormu sudah lengkap.", { exact: false })).toBeVisible();
    await expectA11y(page, "S28 asisten, setelah setup");

    const [ch] = await sql`select id, name, niche, mode from public.channels where office_id = ${f.officeId}`;
    expect(ch).toMatchObject({ name: "Resep 10 Menit", niche: "Resep cepat untuk anak kos, bahan murah.", mode: "manual" });
    const agents = await sql`select id, name, title, brain from public.agents where office_id = ${f.officeId} and kind = 'custom' order by created_at`;
    expect(agents.map((a) => [a.name, a.title, a.brain])).toEqual([["Rafi", "Periset tren", "simulation"], [agents[1].name, "Penulis naskah", "simulation"]]);
    const [sk] = await sql`select s.name, x.agent_id from public.skills s join public.agent_skills x on x.skill_id = s.id where s.office_id = ${f.officeId}`;
    expect(sk).toEqual({ name: "Gaya Resep 10 Menit", agent_id: agents[1].id });
    const tasks = await sql`select kind, trigger, agent_id, channel_id, schedule_times::text[] as times from public.tasks where office_id = ${f.officeId} order by created_at`;
    expect(tasks.map((t) => [t.kind, t.trigger, t.agent_id, t.channel_id])).toEqual([
      ["research", "schedule", agents[0].id, ch.id],
      ["script", "after_task", agents[1].id, ch.id],
    ]);
    expect(tasks[0].times).toEqual(["08:00:00"]);
    const runs = await sql`select status from public.task_runs where office_id = ${f.officeId}`;
    expect(runs).toEqual([{ status: "queued" }]);

    // Percakapan tersimpan: muat ulang tetap ada, kartu yang selesai tidak bisa diklik lagi.
    await page.reload();
    await expect(chat(page).getByText("Channel Resep 10 Menit sudah dibuat.")).toBeVisible();
    await expect(proposal(page, "Buat channel").getByRole("button")).toHaveCount(0);
    await expect(proposal(page, "Buat channel")).toContainText("Sudah dibuat");
  });

  test("F02-H4 perintah bebas: buat skill lalu lewati; kalimat yang tidak dipahami dapat menu", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/asisten`);
    await say(page, "tolong buat skill");
    await expect(chat(page).getByText("Apa nama skill-nya?")).toBeVisible();
    await say(page, "Gaya santai");
    await say(page, "Pakai bahasa santai dan sapaan kamu.");
    await proposal(page, "Buat skill").getByRole("button", { name: "Lewati" }).click();
    await expect(chat(page).getByText("Oke, dilewati.", { exact: false })).toBeVisible();
    expect(await sql`select 1 from public.skills where office_id = ${f.officeId}`).toHaveLength(0);

    await say(page, "qwerty zxcv");
    await expect(chat(page).getByText("belum bisa memahami kalimat bebas", { exact: false })).toBeVisible();
    await expect(chat(page).getByRole("group", { name: "Balasan cepat" }).getByRole("button", { name: "Buat agent" })).toBeVisible();
  });

  test("F02-E2 nama agent dobel: asisten minta nama lain, lalu berhasil", async ({ page }) => {
    const f = await createOffice();
    await sql`insert into public.agents (office_id, name, title) values (${f.officeId}, 'Nadia', 'Admin gudang')`;
    await login(page, f);
    await page.goto(`/o/${f.slug}/asisten`);
    await reply(page, "Mulai setup");
    await reply(page, "Lewati dulu");
    await reply(page, "Lewati dulu");
    await say(page, "Nadia");
    await proposal(page, "Buat agent").last().getByRole("button", { name: "Buat agent" }).click();
    await expect(chat(page).getByText("Belum berhasil: Sudah ada agent dengan nama ini. Ketik nama lain untuk agent ini.")).toBeVisible();
    await say(page, "Nadia Dua");
    await proposal(page, "Buat agent").last().getByRole("button", { name: "Buat agent" }).click();
    await expect(chat(page).getByText("Nadia Dua sudah bergabung sebagai Periset tren.")).toBeVisible();
    const rows = await sql`select name from public.agents where office_id = ${f.officeId} and kind = 'custom' order by name`;
    expect(rows.map((r) => r.name)).toEqual(["Nadia", "Nadia Dua"]);
  });

  test("F02-E3 beranda: kantor kosong mengajak ke Asisten, robot membuka chat", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await expect(page.getByRole("link", { name: "Setup dengan Asisten" })).toHaveAttribute("href", `/o/${f.slug}/asisten`);
    await page.getByRole("group", { name: "Denah kantor" }).getByRole("button", { name: /^Asisten,/ }).click();
    await page.getByRole("link", { name: "Chat asisten" }).click();
    await expect(page).toHaveURL(new RegExp(`/o/${f.slug}/asisten$`));
  });
});
