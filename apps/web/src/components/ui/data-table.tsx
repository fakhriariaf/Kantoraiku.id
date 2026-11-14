import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

/** Desktop: <table>. HP: kartu bertumpuk (label + nilai). */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
}) {
  return (
    <div>
      <table className="hidden w-full overflow-hidden rounded-xl border border-border bg-surface text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2 text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-xs font-semibold text-text-muted", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-surface-2/50">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle text-text", c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-xl border border-border bg-surface p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {columns.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-text-muted">{c.header}</dt>
                  <dd className="text-right text-text">{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
