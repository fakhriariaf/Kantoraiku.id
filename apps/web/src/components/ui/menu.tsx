"use client";

import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-pop animate-fade-in"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  danger,
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean; icon?: React.ReactNode }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-9 cursor-default items-center gap-2 rounded-md px-2.5 text-sm outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 [&_svg]:size-4",
        danger ? "text-danger" : "text-text",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}
