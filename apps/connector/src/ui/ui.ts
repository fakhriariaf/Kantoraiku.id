import type { ConnectorApi } from "../preload.ts";
import type { AiState, UiState } from "../shared.ts";

declare global {
  interface Window {
    kantoraiku: ConnectorApi;
  }
}

const k = window.kantoraiku;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const STATUS: Record<UiState["status"], { text: string; tone: string }> = {
  unpaired: { text: "Belum tersambung", tone: "warn" },
  connecting: { text: "Menyambung…", tone: "busy" },
  online: { text: "Online", tone: "ok" },
  working: { text: "Bekerja", tone: "busy" },
  offline: { text: "Offline", tone: "error" },
  paused: { text: "Dijeda", tone: "warn" },
};

const AI_NAME = { simulation: "Simulasi", openai: "OpenAI", claude: "Claude" } as const;
const AI_TEXT: Record<AiState, { text: string; tone: string }> = {
  ok: { text: "Siap", tone: "ok" },
  missing_key: { text: "Belum ada kunci", tone: "warn" },
  invalid_key: { text: "Kunci salah", tone: "error" },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

let filled = false;
let pairing = false;

function render(s: UiState) {
  const st = STATUS[s.status];
  const chip = $("status");
  chip.textContent = st.text;
  chip.dataset.tone = st.tone;

  const notice = $("notice");
  notice.hidden = !s.notice;
  if (s.notice) {
    notice.textContent = s.notice.text;
    notice.dataset.tone = s.notice.tone;
  }

  $("version").textContent = `Versi ${s.version}`;
  $("update").hidden = !s.update;
  if (s.update) $("update-text").textContent = `Versi ${s.update.version} siap.`;

  const paired = !!s.office;
  $("pair-view").hidden = paired;
  $("main-view").hidden = !paired;

  if (!paired) {
    if (!filled) {
      $<HTMLInputElement>("name").value = s.defaultName;
      $<HTMLInputElement>("server").value = s.defaultServer;
      filled = true;
      $("code").focus();
    }
    return;
  }
  filled = false;

  $("office-title").textContent = s.office!.name;
  $("office-server").textContent = `${s.office!.slug} · ${new URL(s.office!.server).host}`;

  const cur = s.current;
  $("current").hidden = !cur;
  if (cur) {
    $("current-agent").textContent = `${cur.agent}:`;
    $("current-task").textContent = cur.task;
    $("current-msg").textContent = `${cur.pct}% · ${cur.message}`;
    const bar = $("current-bar");
    bar.setAttribute("aria-valuenow", String(cur.pct));
    (bar.firstElementChild as HTMLElement).style.width = `${cur.pct}%`;
  }

  $("pause-btn").textContent = s.status === "paused" ? "Lanjutkan" : "Jeda";

  const ai = $("ai");
  ai.replaceChildren(
    ...(Object.keys(AI_NAME) as (keyof typeof AI_NAME)[]).map((key) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = AI_NAME[key];
      const val = document.createElement("span");
      const t = AI_TEXT[s.ai[key]] ?? AI_TEXT.missing_key;
      val.textContent = t.text;
      val.dataset.tone = t.tone;
      li.append(name, val);
      return li;
    }),
  );

  const auto = $<HTMLInputElement>("autostart");
  auto.checked = s.autoStart;
  auto.disabled = !s.autoStartAvailable;
  $("autostart-hint").textContent = s.autoStartAvailable
    ? "Agent bisa bekerja sesuai jadwal tanpa perlu membuka aplikasi."
    : "Hanya untuk aplikasi yang sudah dipasang (bukan mode pengembangan).";

  const list = $("activity");
  if (!s.activity.length) {
    const li = document.createElement("li");
    li.textContent = "Belum ada aktivitas.";
    list.replaceChildren(li);
  } else {
    list.replaceChildren(
      ...s.activity.slice(0, 12).map((a) => {
        const li = document.createElement("li");
        li.dataset.tone = a.tone;
        const t = document.createElement("time");
        t.dateTime = a.at;
        t.textContent = time(a.at);
        li.append(t, document.createTextNode(a.text));
        return li;
      }),
    );
  }
}

let last: UiState | null = null;
const apply = (s: UiState) => {
  last = s;
  render(s);
};

$("pair-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (pairing) return;
  const err = $("pair-error");
  const btn = $<HTMLButtonElement>("pair-btn");
  const code = $<HTMLInputElement>("code").value;
  if (!code.trim()) {
    err.textContent = "Tempel kode setup dari dashboard dulu.";
    err.hidden = false;
    $("code").focus();
    return;
  }
  pairing = true;
  btn.disabled = true;
  btn.textContent = "Menyambungkan…";
  err.hidden = true;
  const r = await k.pair({ code, name: $<HTMLInputElement>("name").value, server: $<HTMLInputElement>("server").value });
  pairing = false;
  btn.disabled = false;
  btn.textContent = "Sambungkan";
  if (r.error) {
    err.textContent = r.error;
    err.hidden = false;
    $("code").focus();
    return;
  }
  $<HTMLInputElement>("code").value = "";
  apply(await k.state());
});

$("pause-btn").addEventListener("click", async () => {
  const btn = $<HTMLButtonElement>("pause-btn");
  btn.disabled = true;
  if (last?.status === "paused") await k.resume();
  else await k.pause();
  btn.disabled = false;
});
$("dashboard-btn").addEventListener("click", () => void k.openDashboard());
$("videos-btn").addEventListener("click", () => void k.openVideos());
$("keys-btn").addEventListener("click", () => void k.openKeys());
$("autostart").addEventListener("change", (e) => void k.setAutoStart((e.target as HTMLInputElement).checked));
$("unpair-btn").addEventListener("click", () => void k.unpair());
$("update-btn").addEventListener("click", () => void k.installUpdate());

k.onState(apply);
void k.state().then(apply);
