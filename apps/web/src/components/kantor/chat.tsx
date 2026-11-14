import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export type ChatMessage = {
  id: string;
  from: "customer" | "agent" | "human";
  text: string;
  time: string;
  status?: "sent" | "delivered" | "read";
};

const who = { customer: "Pelanggan", agent: "Agent CS", human: "Kamu" };

export function ChatThread({ messages, label }: { messages: ChatMessage[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-2">
      {messages.map((m) => {
        const mine = m.from !== "customer";
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-5 sm:max-w-[70%]",
                m.from === "customer" && "rounded-bl-md border border-border bg-surface text-text",
                m.from === "agent" && "rounded-br-md bg-accent-soft text-text",
                m.from === "human" && "rounded-br-md bg-info-soft text-text",
              )}
            >
              <span className="sr-only">{who[m.from]}: </span>
              {m.from === "human" && <span className="mb-0.5 block text-xs font-semibold text-info">Kamu</span>}
              <p className="whitespace-pre-line">{m.text}</p>
              <span className="mt-1 flex items-center justify-end gap-1 text-xs font-normal text-text-muted">
                {m.time}
                {mine && m.status === "sent" && <Check aria-label="terkirim" className="size-3.5" />}
                {mine && m.status === "delivered" && <CheckCheck aria-label="diterima" className="size-3.5" />}
                {mine && m.status === "read" && <CheckCheck aria-label="dibaca" className="size-3.5 text-info" />}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
