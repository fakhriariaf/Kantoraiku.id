"use client";

import { Archive, Clock, MoreHorizontal, Pencil, Play } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, Eyebrow } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/ui/status-pill";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";

export type AgentStatus = "idle" | "working" | "waiting_user" | "error";

const statusTone = { idle: "ready", working: "working", waiting_user: "waiting", error: "error" } as const;

export function AgentCard({
  id,
  name,
  title,
  status,
  skills,
  schedule,
  builtin,
  archived,
}: {
  id: string;
  name: string;
  title: string;
  status: AgentStatus;
  skills: string[];
  schedule: string;
  builtin?: boolean;
  archived?: boolean;
}) {
  return (
    <Card className={cn("flex flex-col gap-4", archived && "opacity-60")}>
      <div className="flex items-start gap-3">
        <Avatar name={name} seed={id} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-semibold text-text">{name}</h3>
            {builtin && (
              <Chip variant="tag" className="shrink-0">
                bawaan
              </Chip>
            )}
          </div>
          <p className="truncate text-sm text-text-muted">{title}</p>
        </div>
        <Menu>
          <MenuTrigger
            aria-label={`Menu ${name}`}
            className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<Pencil aria-hidden />}>Ubah</MenuItem>
            <MenuItem icon={<Play aria-hidden />}>Jalankan sekarang</MenuItem>
            {!builtin && (
              <>
                <MenuSeparator />
                <MenuItem danger icon={<Archive aria-hidden />}>
                  Arsipkan
                </MenuItem>
              </>
            )}
          </MenuContent>
        </Menu>
      </div>

      <StatusPill tone={statusTone[status]} className="-mt-1 self-start" />

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Skill</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {skills.length ? skills.map((s) => <Chip key={s}>{s}</Chip>) : <span className="text-sm text-text-muted">Belum ada skill</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Jadwal</Eyebrow>
        <p className="flex items-center gap-1.5 text-sm text-text-2">
          <Clock aria-hidden className="size-4 text-text-muted" />
          {schedule}
        </p>
      </div>
    </Card>
  );
}
