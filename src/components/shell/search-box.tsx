import { Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The console's one search input.
 *
 * A GET form, not a client-side filter, and that is the point: the result is a
 * URL the desk can keep open, reload and send to a colleague, it works before
 * any JavaScript has run, and — because every list here is paginated — it
 * filters on the server across the whole table rather than across the twenty-
 * five rows that happen to be on screen.
 *
 * Hidden inputs carry the other filters through, so searching inside a camp
 * roster does not silently widen to every camp.
 */
export function SearchBox({
  placeholder,
  defaultValue,
  /** Other query params to preserve on submit, e.g. `{ camp: campId }`. */
  keep,
  /** Where the clear button goes — the same page with no query at all. */
  clearHref,
  className,
}: {
  placeholder: string;
  defaultValue?: string;
  keep?: Record<string, string | undefined>;
  clearHref: string;
  className?: string;
}) {
  return (
    <form className={cn("flex max-w-md flex-1 items-center gap-2", className)}>
      {Object.entries(keep ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.9}
        />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-9 w-full rounded-lg border border-app-line bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      <button
        type="submit"
        className="press h-9 shrink-0 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
      >
        Search
      </button>
      {defaultValue && (
        <Link
          href={clearHref}
          aria-label="Clear search"
          className="press flex size-9 shrink-0 items-center justify-center rounded-lg border border-app-line text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </Link>
      )}
    </form>
  );
}
