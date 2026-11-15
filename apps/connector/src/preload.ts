import { contextBridge, ipcRenderer } from "electron";
import type { PairInput, UiState } from "./shared.ts";

// Jembatan sempit: tampilan hanya bisa memanggil aksi ini, tanpa akses Node.
const api = {
  state: (): Promise<UiState> => ipcRenderer.invoke("state:get"),
  onState: (fn: (s: UiState) => void) => {
    ipcRenderer.on("state", (_e, s: UiState) => fn(s));
  },
  pair: (input: PairInput): Promise<{ error?: string }> => ipcRenderer.invoke("pair", input),
  unpair: (): Promise<void> => ipcRenderer.invoke("unpair"),
  pause: (): Promise<void> => ipcRenderer.invoke("pause"),
  resume: (): Promise<void> => ipcRenderer.invoke("resume"),
  openDashboard: (): Promise<void> => ipcRenderer.invoke("open:dashboard"),
  openKeys: (): Promise<void> => ipcRenderer.invoke("open:keys"),
  openVideos: (): Promise<void> => ipcRenderer.invoke("open:videos"),
  setAutoStart: (on: boolean): Promise<void> => ipcRenderer.invoke("autostart", on),
  installUpdate: (): Promise<void> => ipcRenderer.invoke("update:install"),
};

export type ConnectorApi = typeof api;
contextBridge.exposeInMainWorld("kantoraiku", api);
