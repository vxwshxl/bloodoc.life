import { cn } from "@/lib/utils";

/**
 * One fact in an overview. `wide` spans the whole row, for values that are
 * long by nature — an address, an email, a list of changes.
 */
export type DetailItem = [label: string, value: React.ReactNode, opts?: { wide?: boolean }];

/**
 * The facts in an overview dialog, as a tinted panel of small labels over
 * values.
 *
 * The same layout the registration dialog uses, shared so every row that opens
 * something — a donor, a certificate, an audit entry, a user — reads the same
 * way: scan the labels, find the value under it. A long two-column list of
 * rules made the eye travel from the far left to the far right for every line.
 *
 * Empty values print a dash, so a field never filled in reads as missing
 * rather than disappearing. No hooks: rendered by Server Components.
 */
export function DetailList({
  items,
  heading,
}: {
  items: DetailItem[];
  heading?: string;
}) {
  return (
    <section>
      {heading && (
        <h3 className="mb-2 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {heading}
        </h3>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-app-line-soft bg-muted/40 p-4 sm:grid-cols-3">
        {items.map(([label, value, opts]) => (
          <div key={label} className={cn("min-w-0", opts?.wide && "col-span-2 sm:col-span-3")}>
            <dt className="text-[0.6875rem] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium break-words">
              {value === null || value === undefined || value === "" ? "—" : value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
