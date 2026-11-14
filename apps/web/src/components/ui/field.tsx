"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-border-input bg-surface text-base text-text placeholder:text-text-muted transition-colors hover:border-text-muted focus-visible:border-accent aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-muted read-only:bg-surface-2";

const heights = { md: "h-control-md px-3", lg: "h-control-lg px-4" } as const;

type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

/** Label + kontrol + hint + error, dengan id dan aria-describedby yang tersambung. */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-text">
        {label}
        {optional && <span className="ml-1 font-normal text-text-muted">(opsional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs font-normal text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Input({
  size = "md",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: keyof typeof heights }) {
  return <input className={cn(control, heights[size], className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "min-h-24 px-3 py-2.5 leading-6", className)} {...props} />;
}

/** Input dengan teks tetap di depan/belakang, mis. suffix ".kantoraiku.id". */
export function InputGroup({
  prefix,
  suffix,
  size = "md",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "size" | "prefix"> & {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: keyof typeof heights;
}) {
  const addon = "flex items-center bg-surface-2 px-3 text-sm text-text-muted";
  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-md border border-border-input bg-surface transition-colors hover:border-text-muted has-[input:focus-visible]:border-accent has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent has-[input[aria-invalid=true]]:border-danger",
        size === "lg" ? "h-control-lg" : "h-control-md",
        className,
      )}
    >
      {prefix && <span className={cn(addon, "border-r border-border-input")}>{prefix}</span>}
      <input
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-text placeholder:text-text-muted focus-visible:outline-none"
        {...props}
      />
      {suffix && <span className={cn(addon, "border-l border-border-input")}>{suffix}</span>}
    </div>
  );
}

/** Select native: keyboard dan pembaca layar HP bekerja tanpa kode tambahan. */
export function Select({
  size = "md",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"select">, "size"> & { size?: keyof typeof heights }) {
  return (
    <div className="relative">
      <select className={cn(control, heights[size], "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-muted"
      />
    </div>
  );
}
