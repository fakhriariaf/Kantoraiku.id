import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import { addContentSetup, createOffice, expect, expectA11y as expectA11yWeb, login, queueRun, setupCode, sql, test, visible } from "./helpers";

// Aplikasi konektor Windows (apps/connector) dijalankan sungguhan dengan Electron, terhadap server lokal.
// Mode dev: tanpa start otomatis dan tanpa cek pembaruan (keduanya hanya untuk aplikasi terpasang).

const APP = resolve("apps/connector");
const ELECTRON = createRequire(join(APP, "package.json"))("electron") as unknown as string;

test.beforeAll(() => {
  execFileSync(process.execPath, ["build.mjs"], { cwd: APP, stdio: "pipe" });
});

async function launch(dir: string): Promise<{ app: ElectronApplication; win: Page }> {
  const app = await _electron.launch({
    executablePath: ELECTRON,
    args: [APP],
    env: {
      ...process.env,
      KANTORAIKU_CONFIG_DIR: dir,
      KANTORAIKU_SERVER: "http://localhost:3000",
      KANTORAIKU_NO_UPDATE: "1",
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      ELEVENLABS_API_KEY: "",
      PEXELS_API_KEY: "",
      FAL_KEY: "",
      KANTORAIKU_VIDEO_DIR: join(dir, "videos"),
    },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  // Dialog konfirmasi native tidak bisa diklik Playwright: jawab "ya" dari proses utama.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => ({ response: 0, checkboxChecked: false })) as typeof dialog.showMessageBox;
  });
  return { app, win };
}

// AxeBuilder membuka tab baru, yang tidak didukung jendela Electron: suntik axe-core langsung.
const AXE = readFileSync(createRequire(require.resolve("@axe-core/playwright")).resolve("axe-core/axe.min.js"), "utf8");
async function expectA11y(p: Page, label: string) {
  if (!p.url().startsWith("file:")) return expectA11yWeb(p, label);
  await p.evaluate(`${AXE};0`);
  const v = await p.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run({
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations.map((x) => `${x.id} (${x.impact}): ${x.nodes.length} elemen, contoh ${x.nodes[0]?.target.join(" ")}`);
  });
  expect(v, `pelanggaran aksesibilitas di ${label}`).toEqual([]);
}

const tmp = () => mkdtempSync(join(tmpdir(), "kantoraiku-app-"));

test.describe("F02 konektor Windows (aplikasi)", () => {
  test("F02-H5 tempel kode di aplikasi -> tersambung, PC online di dashboard, tetap tersambung setelah dibuka ulang", async ({ page }) => {
    const f = await createOffice();
    const dir = tmp();
    let { app, win } = await launch(dir);

    await expect(win.getByRole("heading", { name: "Sambungkan PC ini ke kantor" })).toBeVisible();
    await expect(win.getByRole("status")).toHaveText("Belum tersambung");
    await expectA11y(win, "aplikasi konektor: belum tersambung");

    // Kode kosong dan kode salah ditolak dengan pesan yang jelas.
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("alert").filter({ hasText: "Tempel kode setup" })).toBeVisible();
    await win.getByLabel("Kode setup").fill("SALAH123");
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("alert").filter({ hasText: /Kode setup salah/ })).toBeVisible();

    // Kode ditempel dengan spasi (seperti tampilan di dashboard) tetap diterima.
    const code = await setupCode(f.officeId);
    await win.getByLabel("Kode setup").fill(`${code.slice(0, 4)} ${code.slice(4).toLowerCase()}`);
    await win.getByLabel("Nama PC").fill("PC Aplikasi Uji");
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("heading", { name: `Kantor ${f.slug.slice(4)}` })).toBeVisible();
    await expect(win.getByRole("status")).toHaveText("Online");
    await expect(win.getByText("Simulasi").locator("..")).toContainText("Siap");
    await expect(win.getByText("OpenAI").locator("..")).toContainText("Belum ada kunci");
    await expectA11y(win, "aplikasi konektor: tersambung");

    const [dev] = await sql`select name, kind, connector_version, status from public.devices where office_id = ${f.officeId}`;
    expect(dev).toMatchObject({ name: "PC Aplikasi Uji", kind: "pc_windows", connector_version: "0.2.0", status: "online" });

    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    await expect(page.getByRole("heading", { name: "PC Aplikasi Uji" })).toBeVisible();
    await expect(page.getByText("Konektor 0.2.0 · PC Windows").filter({ visible: true }).first()).toBeVisible();

    // Dibuka ulang (mis. setelah Windows menyala): langsung tersambung tanpa kode baru.
    await app.close();
    ({ app, win } = await launch(dir));
    await expect(win.getByRole("status")).toHaveText("Online");
    await expect(win.getByRole("heading", { name: `Kantor ${f.slug.slice(4)}` })).toBeVisible();
    await app.close();
  });

  test("F02-H6 aplikasi mengerjakan tugas dari antrean dan menampilkannya di aktivitas", async () => {
    const f = await createOffice();
    const s = await addContentSetup(f.officeId);
    const { app, win } = await launch(tmp());
    await win.getByLabel("Kode setup").fill(await setupCode(f.officeId));
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("status")).toHaveText("Online");

    const runId = await queueRun(f.officeId, s.researchTaskId);
    await expect(win.getByRole("list").filter({ hasText: "Periset Uji selesai: Riset uji" })).toBeVisible({ timeout: 60_000 });
    const [run] = await sql`select status from public.task_runs where id = ${runId}`;
    expect(run.status).toBe("succeeded");

    // Jeda: tidak mengambil tugas baru.
    await win.getByRole("button", { name: "Jeda" }).click();
    await expect(win.getByRole("status")).toHaveText("Dijeda");
    await expect(win.getByRole("button", { name: "Lanjutkan" })).toBeVisible();
    await app.close();
  });

  test("F02-E4 putuskan dari aplikasi -> PC dicabut di dashboard; F02-E5 dicabut dari dashboard -> aplikasi minta kode baru", async ({ page }) => {
    const f = await createOffice();
    const { app, win } = await launch(tmp());
    await win.getByLabel("Kode setup").fill(await setupCode(f.officeId));
    await win.getByLabel("Nama PC").fill("PC Diputus");
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("status")).toHaveText("Online");

    await win.getByRole("button", { name: "Putuskan PC ini dari kantor" }).click();
    await expect(win.getByRole("heading", { name: "Sambungkan PC ini ke kantor" })).toBeVisible();
    await expect(win.getByRole("alert").filter({ hasText: "sudah diputuskan" })).toBeVisible();
    const [d1] = await sql`select status from public.devices where office_id = ${f.officeId} and name = 'PC Diputus'`;
    expect(d1.status).toBe("revoked");

    // Sambungkan lagi, lalu cabut dari dashboard.
    await win.getByLabel("Kode setup").fill(await setupCode(f.officeId));
    await win.getByLabel("Nama PC").fill("PC Dicabut Dashboard");
    await win.getByRole("button", { name: "Sambungkan" }).click();
    await expect(win.getByRole("status")).toHaveText("Online");

    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    await visible(page, "button", "Menu PC Dicabut Dashboard").click();
    await page.getByRole("menuitem", { name: "Cabut perangkat" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cabut" }).click();

    await expect(win.getByRole("alert").filter({ hasText: "dicabut dari kantor" })).toBeVisible({ timeout: 30_000 });
    await expect(win.getByRole("heading", { name: "Sambungkan PC ini ke kantor" })).toBeVisible();
    await app.close();
  });

  test("F02-H7 dashboard: tombol unduh installer Windows dan langkah tempel kode", async ({ page }) => {
    const f = await createOffice();
    await login(page, f);
    await page.goto(`/o/${f.slug}/perangkat`);
    const dl = visible(page, "link", "Unduh untuk Windows");
    await expect(dl).toHaveAttribute("href", /Kantoraiku-Setup\.exe$/);
    await expect(page.getByText("Buka aplikasi Kantoraiku di PC, tempel kodenya").filter({ visible: true }).first()).toBeVisible();
    // Dev (bukan domain publik): alamat server lokal ditampilkan untuk pengaturan lanjutan.
    await expect(page.getByText("http://localhost:3000").filter({ visible: true }).first()).toBeVisible();
    await expectA11y(page, "S29 perangkat dengan installer");
  });
});
