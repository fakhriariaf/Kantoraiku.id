// Konektor Kantoraiku untuk Windows: aplikasi tray yang menjalankan agent kantor di PC ini.
// Logika kerja (pairing, heartbeat, ambil tugas, otak AI, render video) dipakai bersama CLI di packages/runner.
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { appendFileSync, existsSync, mkdirSync, statSync, truncateSync } from "node:fs";
import { join } from "node:path";
import { client, HttpError } from "@kantoraiku/runner/src/api.ts";
import { clearConfig, configDir, loadConfig, type ConnectorConfig } from "@kantoraiku/runner/src/config.ts";
import { defaultPcName, pairPc } from "@kantoraiku/runner/src/pair.ts";
import { aiStatus, work, type WorkerEvent } from "@kantoraiku/runner/src/worker.ts";
import { videoRoot } from "@kantoraiku/runner/src/video/render.ts";
import { initUpdates, installUpdate } from "./updates.ts";
import { checkServer, normalizeCode, type PairInput, type UiState } from "./shared.ts";

declare const __DEFAULT_SERVER__: string;
const DEFAULT_SERVER = process.env.KANTORAIKU_SERVER || __DEFAULT_SERVER__;
const VERSION = app.getVersion();
/** Diluncurkan Windows saat login: langsung ke tray tanpa membuka jendela. */
const HIDDEN = process.argv.includes("--hidden");
/** Start bersama Windows hanya untuk aplikasi terpasang (dan bisa dimatikan untuk uji otomatis). */
const CAN_AUTOSTART = app.isPackaged && !process.env.KANTORAIKU_NO_AUTOSTART;

// Folder konfigurasi lain (uji otomatis, atau dua kantor di satu PC): data Electron ikut dipisah, supaya
// kunci satu-instance tidak bentrok dengan aplikasi Kantoraiku yang sudah terpasang dan berjalan.
if (process.env.KANTORAIKU_CONFIG_DIR) app.setPath("userData", join(process.env.KANTORAIKU_CONFIG_DIR, "app"));

// Satu konektor per user: membuka lagi dari Start Menu cukup memunculkan jendela yang ada.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.setAppUserModelId("id.kantoraiku.connector");

// FFmpeg ikut di dalam installer (resources/ffmpeg.exe); saat dev dipakai paket ffmpeg-static.
if (app.isPackaged && !process.env.FFMPEG_PATH) process.env.FFMPEG_PATH = join(process.resourcesPath, "ffmpeg.exe");

const asset = (f: string) => join(__dirname, "..", "assets", f);

// ---------------------------------------------------------------------------
// Log ke file (untuk bantuan) + ke tampilan
// ---------------------------------------------------------------------------

const logDir = join(process.env.KANTORAIKU_CONFIG_DIR ?? configDir(), "logs");
const logFile = join(logDir, "konektor.log");
try {
  mkdirSync(logDir, { recursive: true });
  if (existsSync(logFile) && statSync(logFile).size > 2_000_000) truncateSync(logFile, 0);
} catch {
  // Log file hanya pelengkap.
}

function log(...a: unknown[]) {
  const text = a.map((x) => (typeof x === "string" ? x : x instanceof Error ? x.message : JSON.stringify(x))).join(" ");
  try {
    appendFileSync(logFile, `${new Date().toISOString()} ${text}\n`);
  } catch {
    // abaikan
  }
}

// ---------------------------------------------------------------------------
// Keadaan
// ---------------------------------------------------------------------------

let cfg: ConnectorConfig | null = loadConfig();
const state: UiState = {
  version: VERSION,
  defaultServer: DEFAULT_SERVER,
  defaultName: defaultPcName(),
  office: null,
  status: "unpaired",
  current: null,
  ai: aiStatus(),
  activity: [],
  autoStart: false,
  autoStartAvailable: CAN_AUTOSTART,
  update: null,
  notice: null,
};

function activity(text: string, tone: "info" | "ok" | "error" = "info") {
  log(text);
  state.activity = [{ at: new Date().toISOString(), text, tone }, ...state.activity].slice(0, 30);
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

let noticeTimer: NodeJS.Timeout | null = null;

function push() {
  // Pesan berhasil hilang sendiri; pesan galat tetap sampai keadaannya berubah.
  if (state.notice?.tone === "ok" && !noticeTimer) {
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      if (state.notice?.tone === "ok") {
        state.notice = null;
        push();
      }
    }, 15_000);
  }
  state.ai = aiStatus();
  state.office = cfg ? { name: cfg.officeName, slug: cfg.officeSlug, server: cfg.server } : null;
  state.autoStart = CAN_AUTOSTART && app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin;
  win?.webContents.send("state", state);
  refreshTray();
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

let stopper: AbortController | null = null;
let running: Promise<void> | null = null;

function onWorkerEvent(e: WorkerEvent) {
  switch (e.type) {
    case "online":
      if (!state.current && state.status !== "paused") state.status = e.ok ? "online" : "offline";
      if (!e.ok) state.notice = { tone: "error", text: `Tidak bisa menghubungi server: ${e.error ?? "koneksi gagal"}` };
      else if (state.notice?.tone === "error") state.notice = null;
      break;
    case "run_start":
      state.status = "working";
      state.current = { agent: e.agent, task: e.task, pct: 0, message: "Mulai" };
      activity(`${e.agent} mulai: ${e.task}`);
      break;
    case "progress":
      if (state.current) state.current = { ...state.current, pct: e.pct, message: e.message };
      break;
    case "run_end":
      activity(e.ok ? `${state.current?.agent ?? "Agent"} selesai: ${state.current?.task ?? ""}` : `Gagal: ${e.message}`, e.ok ? "ok" : "error");
      state.current = null;
      if (state.status === "working") state.status = "online";
      break;
    case "secrets":
      if (e.total) activity(`Kunci dari dashboard terpasang: ${e.applied} dari ${e.total}`, e.applied === e.total ? "ok" : "error");
      break;
  }
  push();
}

function startWorker() {
  if (running || !cfg) return;
  const c = cfg;
  stopper = new AbortController();
  state.status = "connecting";
  push();
  running = work(client(c), {
    officeSlug: c.officeSlug,
    privateKey: c.privateKey,
    signal: stopper.signal,
    version: VERSION,
    log,
    onEvent: onWorkerEvent,
  })
    .then((result) => {
      if (result === "revoked") {
        clearConfig();
        cfg = null;
        state.status = "unpaired";
        state.notice = { tone: "error", text: "PC ini dicabut dari kantor di dashboard. Buat kode setup baru untuk menyambung lagi." };
        activity("PC ini dicabut dari kantor.", "error");
        showWindow();
      }
    })
    .catch((e) => {
      activity(`Konektor berhenti: ${(e as Error).message}`, "error");
      state.status = "offline";
    })
    .finally(() => {
      running = null;
      stopper = null;
      state.current = null;
      push();
    });
}

/** Berhenti mengambil tugas; tugas yang sedang jalan diselesaikan dulu. */
async function stopWorker() {
  stopper?.abort();
  await running;
}

// ---------------------------------------------------------------------------
// Jendela + tray
// ---------------------------------------------------------------------------

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 700,
    minWidth: 380,
    minHeight: 520,
    show: false,
    title: "Kantoraiku",
    icon: asset("icon.png"),
    backgroundColor: "#f7f8fa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  win.setMenu(null);
  // Jendela hanya menampilkan halaman lokal; tautan luar dibuka di browser lewat tombol.
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win?.hide();
  });
  win.once("ready-to-show", () => {
    if (!HIDDEN || !cfg) win?.show();
  });
  void win.loadFile(join(__dirname, "ui", "index.html"));
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

const STATUS_LABEL: Record<UiState["status"], string> = {
  unpaired: "Belum tersambung",
  connecting: "Menyambung…",
  online: "Online, menunggu tugas",
  working: "Sedang bekerja",
  offline: "Tidak bisa menghubungi server",
  paused: "Dijeda",
};

function refreshTray() {
  if (!tray) return;
  const label = state.current ? `${state.current.agent}: ${state.current.task} (${state.current.pct}%)` : STATUS_LABEL[state.status];
  tray.setToolTip(`Kantoraiku: ${label}`.slice(0, 127));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label, enabled: false },
      { type: "separator" },
      { label: "Buka Kantoraiku", click: showWindow },
      { label: "Buka dashboard", enabled: !!cfg, click: () => void openDashboard() },
      cfg
        ? state.status === "paused"
          ? { label: "Lanjutkan", click: () => void resume() }
          : { label: "Jeda", click: () => void pause() }
        : { label: "Jeda", enabled: false },
      { type: "separator" },
      { label: "Keluar", click: () => void quit() },
    ]),
  );
}

function createTray() {
  const img = nativeImage.createFromPath(asset("tray.png"));
  img.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(asset("tray@2x.png")).toPNG() });
  tray = new Tray(img);
  tray.on("click", showWindow);
  refreshTray();
}

async function quit() {
  if (state.current) {
    const r = await dialog.showMessageBox({
      type: "question",
      buttons: ["Keluar sekarang", "Batal"],
      defaultId: 1,
      cancelId: 1,
      title: "Keluar dari Kantoraiku",
      message: `${state.current.agent} sedang mengerjakan "${state.current.task}".`,
      detail: "Kalau keluar sekarang, tugas ini diulang otomatis saat konektor menyala lagi.",
    });
    if (r.response !== 0) return;
  }
  quitting = true;
  stopper?.abort();
  app.quit();
}

// ---------------------------------------------------------------------------
// Aksi dari tampilan
// ---------------------------------------------------------------------------

async function pause() {
  state.status = "paused";
  activity("Dijeda: agent tidak mengambil tugas baru.");
  push();
  await stopWorker();
  state.status = "paused";
  push();
}

async function resume() {
  activity("Dilanjutkan.");
  state.notice = null;
  startWorker();
}

async function openDashboard() {
  if (!cfg) return;
  const url = new URL(`/o/${encodeURIComponent(cfg.officeSlug)}`, cfg.server);
  if (url.protocol === "https:" || url.protocol === "http:") await shell.openExternal(url.toString());
}

async function pair(input: PairInput): Promise<{ error?: string }> {
  const code = normalizeCode(input.code);
  if (!code) return { error: "Kode setup terdiri dari 8 huruf atau angka. Salin dari dashboard, menu Perangkat." };
  const server = checkServer(input.server || DEFAULT_SERVER);
  if ("error" in server) return { error: server.error };
  try {
    const r = await pairPc({ server: server.url, code, name: input.name, version: VERSION });
    cfg = r.config;
    state.notice = { tone: "ok", text: `Tersambung ke ${cfg.officeName}. Agent mulai bekerja di PC ini.` };
    activity(`Tersambung ke kantor ${cfg.officeName}.`, "ok");
    // Setelah tersambung, konektor ikut menyala bersama Windows (bisa dimatikan di pengaturan).
    if (CAN_AUTOSTART) app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] });
    startWorker();
    return {};
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    const host = new URL(server.url).host;
    return { error: `Tidak bisa menghubungi ${host}. Cek koneksi internet, lalu coba lagi.` };
  }
}

async function unpair(): Promise<void> {
  const r = await dialog.showMessageBox(win!, {
    type: "warning",
    buttons: ["Putuskan", "Batal"],
    defaultId: 1,
    cancelId: 1,
    title: "Putuskan PC ini",
    message: `Putuskan PC ini dari ${cfg?.officeName ?? "kantor"}?`,
    detail: "Agent tidak akan bekerja di PC ini lagi sampai kamu menyambungkannya dengan kode setup baru. Video yang sudah dibuat tetap di PC.",
  });
  if (r.response !== 0 || !cfg) return;
  const c = cfg;
  await stopWorker();
  let note = "";
  try {
    await fetch(new URL("/api/device/unpair", c.server), {
      method: "POST",
      headers: { authorization: `Bearer ${c.deviceToken}`, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    }).then((res) => {
      if (!res.ok && res.status !== 401) throw new Error(`HTTP ${res.status}`);
    });
  } catch {
    note = " Server tidak bisa dihubungi: cabut juga PC ini di dashboard, menu Perangkat.";
  }
  clearConfig();
  cfg = null;
  state.status = "unpaired";
  state.notice = { tone: note ? "error" : "ok", text: `PC ini sudah diputuskan dari ${c.officeName}.${note}` };
  activity(`Diputuskan dari ${c.officeName}.`);
  push();
}

ipcMain.handle("state:get", () => {
  state.ai = aiStatus();
  state.office = cfg ? { name: cfg.officeName, slug: cfg.officeSlug, server: cfg.server } : null;
  state.autoStart = CAN_AUTOSTART && app.getLoginItemSettings({ args: ["--hidden"] }).openAtLogin;
  return state;
});
ipcMain.handle("pair", (_e, input: PairInput) => pair(input));
ipcMain.handle("unpair", () => unpair());
ipcMain.handle("pause", () => pause());
ipcMain.handle("resume", () => resume());
ipcMain.handle("open:dashboard", () => openDashboard());
ipcMain.handle("open:videos", async () => {
  const dir = videoRoot();
  mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
});
ipcMain.handle("open:keys", async () => {
  if (!cfg) return;
  await shell.openExternal(new URL(`/o/${encodeURIComponent(cfg.officeSlug)}/kunci`, cfg.server).toString());
});
ipcMain.handle("autostart", (_e, on: boolean) => {
  if (CAN_AUTOSTART) app.setLoginItemSettings({ openAtLogin: !!on, args: ["--hidden"] });
  push();
});
ipcMain.handle("update:install", async () => {
  await stopWorker();
  quitting = true;
  installUpdate();
});

// ---------------------------------------------------------------------------
// Mulai
// ---------------------------------------------------------------------------

app.on("second-instance", showWindow);
app.on("window-all-closed", () => {
  // Tetap jalan di tray.
});
app.on("before-quit", () => {
  quitting = true;
});

void app.whenReady().then(() => {
  createWindow();
  createTray();
  activity(cfg ? `Konektor ${VERSION} menyala untuk ${cfg.officeName}.` : `Konektor ${VERSION} menyala. Belum tersambung ke kantor.`);
  startWorker();
  initUpdates({
    log,
    onReady: (version) => {
      state.update = { version };
      activity(`Versi ${version} sudah diunduh. Mulai ulang untuk memasang.`, "ok");
      push();
    },
  });
  push();
});
