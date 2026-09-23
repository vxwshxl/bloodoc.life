/**
 * Label / value pairs for an overview dialog. Empty values print a dash, so a
 * field that was never filled in reads as missing rather than disappearing.
 *
 * No hooks: rendered by Server Components and handed to `DetailRow`.
 */
export function DetailList({
  items,
  heading,
}: {
  items: [label: string, value: React.ReactNode][];
  heading?: string;
}) {
  return (
    <div>
      {heading && (
        <p className="mb-2 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {heading}
        </p>
      )}
      <dl className="flex flex-col gap-2 text-sm">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-4 border-b border-app-line-soft pb-2 last:border-b-0"
          >
            <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium break-words">
              {value === null || value === undefined || value === "" ? "—" : value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
