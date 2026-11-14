import { Avatar } from "@/components/ui/avatar";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { FeedItem } from "@/components/kantor/feed";

const agents: { id: string; name: string; title: string; tone: StatusTone }[] = [
  { id: "demo-dimas", name: "Dimas", title: "Periset tren", tone: "working" },
  { id: "demo-laras", name: "Laras", title: "Penulis naskah", tone: "waiting" },
  { id: "demo-asisten", name: "Asisten", title: "Asisten setup", tone: "ready" },
];

/**
 * Contoh kantor di hero landing (S01): data contoh, bukan data pengguna.
 * Pengganti gambar kantor 3D sampai aset milik Kantoraiku sendiri ada.
 */
export function OfficePreview() {
  return (
    <figure className="relative pb-20">
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-text-muted">studio-senja.kantoraiku.id</span>
            <span className="text-base font-semibold text-text">Kantor Studio Senja</span>
          </div>
          <StatusPill tone="online">PC online</StatusPill>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3 last:pb-0">
              <Avatar name={a.name} seed={a.id} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text">{a.name}</span>
                <span className="truncate text-xs font-normal text-text-muted">{a.title}</span>
              </div>
              <StatusPill tone={a.tone} />
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute right-0 bottom-0 left-6 rounded-xl border border-border bg-surface p-4 shadow-pop sm:left-auto sm:w-80">
        <FeedItem
          e={{
            id: "demo-1",
            agentId: "demo-laras",
            agentName: "Laras",
            text: "mengajukan naskah untuk kamu setujui",
            role: "Penulis naskah",
            at: "2026-01-01T06:20:00+07:00",
            timeLabel: "baru saja",
          }}
        />
      </div>
      <figcaption className="sr-only">
        Contoh kantor: Dimas sedang meriset, naskah Laras menunggu persetujuan, PC online.
      </figcaption>
    </figure>
  );
}
