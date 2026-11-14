"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Archive, Clock, MoreHorizontal, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StatusPill } from "@/components/ui/status-pill";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { useServerCall } from "@/lib/use-server-call";

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
  editHref,
  brainLabel,
  archiveAction,
}: {
  id: string;
  name: string;
  title: string;
  status: AgentStatus;
  skills: string[];
  schedule: string;
  builtin?: boolean;
  archived?: boolean;
  editHref?: string;
  brainLabel?: string;
  archiveAction?: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const call = useServerCall();

  return (
    <Card className={cn("flex flex-col gap-4", archived && "opacity-60")}>
      <div className="flex items-start gap-3">
        <Avatar name={name} seed={id} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-semibold text-text">
              {editHref ? (
                <Link href={editHref} className="hover:underline hover:underline-offset-4">
                  {name}
                </Link>
              ) : (
                name
              )}
            </h3>
            {builtin && (
              <Chip variant="tag" className="shrink-0">
                bawaan
              </Chip>
            )}
          </div>
          <p className="truncate text-sm text-text-muted">{title}</p>
        </div>
        {(editHref || archiveAction) && (
          <Menu>
            <MenuTrigger
              aria-label={`Menu ${name}`}
              className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </MenuTrigger>
            <MenuContent>
              {editHref && (
                <MenuItem asChild>
                  <Link href={editHref}>
                    <Pencil aria-hidden />
                    Ubah
                  </Link>
                </MenuItem>
              )}
              {archiveAction && !builtin && (
                <>
                  <MenuSeparator />
                  <MenuItem danger icon={<Archive aria-hidden />} onSelect={() => setConfirm(true)}>
                    Arsipkan
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        )}
      </div>

      <div className="-mt-1 flex flex-wrap items-center gap-2">
        <StatusPill tone={statusTone[status]} />
        {brainLabel && <Chip variant="outline">{brainLabel}</Chip>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Skill</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {skills.length ? skills.map((s) => <Chip key={s}>{s}</Chip>) : <span className="text-sm text-text-muted">Belum ada skill</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow>Jadwal</Eyebrow>
        <p className="flex items-center gap-1.5 text-sm text-text-2">
          <Clock aria-hidden className="size-4 shrink-0 text-text-muted" />
          {schedule}
        </p>
      </div>

      {archiveAction && (
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent
            title={`Arsipkan ${name}?`}
            description="Tugas milik agent ini dimatikan dan antreannya dibatalkan. Riwayat kerjanya tetap tersimpan."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary">Batal</Button>
                </DialogClose>
                <Button variant="danger" loading={pending} onClick={() => start(async () => { await call(archiveAction); setConfirm(false); })}>
                  Arsipkan
                </Button>
              </>
            }
          />
        </Dialog>
      )}
    </Card>
  );
}
