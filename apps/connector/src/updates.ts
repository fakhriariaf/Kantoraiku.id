import { app } from "electron";
import { autoUpdater } from "electron-updater";

const SIX_HOURS = 6 * 60 * 60 * 1000;

/**
 * Pembaruan otomatis dari GitHub Releases (lihat publish di electron-builder.yml).
 * Diunduh diam-diam; dipasang saat aplikasi ditutup, atau saat user menekan "Mulai ulang".
 */
export function initUpdates(opts: { log: (...a: unknown[]) => void; onReady: (version: string) => void }) {
  if (!app.isPackaged || process.env.KANTORAIKU_NO_UPDATE) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: () => {}, warn: (m: unknown) => opts.log("update:", m), error: (m: unknown) => opts.log("update:", m), debug: () => {} };
  autoUpdater.on("update-downloaded", (info) => opts.onReady(info.version));
  const check = () => autoUpdater.checkForUpdates().catch((e: Error) => opts.log("Cek pembaruan gagal:", e.message));
  void check();
  setInterval(check, SIX_HOURS).unref();
}

export function installUpdate() {
  // isSilent: pasang tanpa jendela installer; isForceRunAfter: buka lagi setelah terpasang.
  autoUpdater.quitAndInstall(true, true);
}
