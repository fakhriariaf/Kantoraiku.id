export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl">{title}</h1>
        {description && <p className="text-sm text-text-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg">{children}</h2>;
}
