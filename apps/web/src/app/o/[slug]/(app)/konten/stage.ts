import type { StatusTone } from "@/components/ui/status-pill";

export const STAGE: Record<string, { tone: StatusTone; label: string }> = {
  scripting: { tone: "working", label: "Sedang ditulis" },
  script_review: { tone: "waiting", label: "Menunggu kamu" },
  script_approved: { tone: "online", label: "Naskah disetujui" },
  rendering: { tone: "working", label: "Membuat video" },
  video_review: { tone: "waiting", label: "Video menunggu kamu" },
  video_approved: { tone: "online", label: "Video disetujui" },
  scheduled: { tone: "info", label: "Terjadwal" },
  published: { tone: "online", label: "Terbit" },
  rejected: { tone: "offline", label: "Ditolak" },
  failed: { tone: "error", label: "Gagal" },
};
