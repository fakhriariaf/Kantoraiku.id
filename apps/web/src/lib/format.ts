// Format tampilan Bahasa Indonesia. Aman dipakai di server dan client.

export function rupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });

export function relativeTime(at: Date | string, now: number) {
  const diffS = Math.round((new Date(at).getTime() - now) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 45) return "baru saja";
  if (abs < 3600) return rtf.format(Math.round(diffS / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffS / 3600), "hour");
  return rtf.format(Math.round(diffS / 86400), "day");
}

export function dateTime(at: Date | string, timeZone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(at));
}

export function timeOnly(at: Date | string, timeZone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(at));
}

/** "studio-budi" -> "Studio Budi" */
export function nameFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const DAY = ["", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Ringkasan jadwal tugas untuk kartu: "Setiap hari pukul 06.00", "Sen-Jum pukul 06.00". */
export function scheduleLabel(t: {
  trigger: string;
  schedule_times: string[];
  schedule_days: number[];
  after_task_name?: string | null;
}) {
  if (t.trigger === "manual") return "Manual";
  if (t.trigger === "after_task") return `Setelah "${t.after_task_name ?? "tugas lain"}" selesai`;
  if (t.trigger === "event") return "Saat ada pesan masuk";
  const times = t.schedule_times.map((x) => x.slice(0, 5).replace(":", ".")).join(", ");
  const days = [...t.schedule_days].sort();
  const daysLabel =
    days.length === 7
      ? "Setiap hari"
      : days.join() === "1,2,3,4,5"
        ? "Sen-Jum"
        : days.map((d) => DAY[d]).join(", ");
  return `${daysLabel} pukul ${times}`;
}
