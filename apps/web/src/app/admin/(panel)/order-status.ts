import type { StatusTone } from "@/components/ui/status-pill";
import type { OrderRow } from "@/server/orders";

export const orderStatus: Record<OrderRow["status"], { tone: StatusTone; label: string }> = {
  pending: { tone: "waiting", label: "Menunggu bayar" },
  paid: { tone: "online", label: "Lunas" },
  expired: { tone: "offline", label: "Kedaluwarsa" },
  cancelled: { tone: "offline", label: "Dibatalkan" },
  refunded: { tone: "info", label: "Dikembalikan" },
};
