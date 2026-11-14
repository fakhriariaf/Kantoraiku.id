"use client";

import { useId } from "react";
import { Switch as RSwitch } from "radix-ui";
import { cn } from "@/lib/cn";

/** Switch selalu berpasangan dengan label teks. */
export function Switch({
  label,
  description,
  className,
  ...props
}: React.ComponentProps<typeof RSwitch.Root> & { label: React.ReactNode; description?: React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="text-xs font-normal text-text-muted">
            {description}
          </p>
        )}
      </div>
      <RSwitch.Root
        id={id}
        aria-describedby={description ? `${id}-d` : undefined}
        className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill bg-border-strong transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
        {...props}
      >
        <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-pill bg-surface shadow-xs transition-transform data-[state=checked]:translate-x-[18px]" />
      </RSwitch.Root>
    </div>
  );
}
