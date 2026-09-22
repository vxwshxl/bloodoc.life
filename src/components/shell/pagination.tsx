import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The console's one pager.
 *
 * State lives in the URL, not in component state, and that is the whole design.
 * A roster page open at the camp desk gets reloaded, bookmarked, and sent to a
 * colleague over WhatsApp; a page number held in React survives none of those.
 * It also means this is a Server Component and the rows never reach the browser
 * until they are asked for.
 *
 * `?page=` is 1-based because it is read by people, and the window of numbers
 * is clamped rather than scrolled: a 900-row donor list would otherwise render
 * forty-five links nobody will use.
 */

export const DEFAULT_PAGE_SIZE = 25;

/** Parse `?page=` defensively — it is a string from a URL bar, not an integer. */
export function pageFromParams(value: string | undefined, pageCount = Infinity): number {
  const n = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, Math.max(1, pageCount === Infinity ? n : pageCount));
}

/** The Supabase `.range()` pair for a 1-based page. */
export function rangeFor(page: number, pageSize = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

/**
 * The numbers to show: first, last, and a window around the current page, with
 * gaps collapsed to an ellipsis.
 */
function windowed(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push("gap");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pageCount - 1) out.push("gap");
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  /** Path without a query string, e.g. "/admin/donors". */
  basePath,
  /** Every other filter currently applied, carried across page changes. */
  params,
  /** What one row is called, for the count line. */
  unit = "row",
}: {
  page: number;
  total: number;
  pageSize?: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  unit?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // A filter dropped here would silently reset the roster to "all camps" the
  // moment somebody turned a page.
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const linkBase =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-line-soft px-5 py-3">
      <p className="text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
        {total === 0
          ? `No ${unit}s`
          : `${first}–${last} of ${total} ${unit}${total === 1 ? "" : "s"}`}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {/* A disabled arrow is a span, not a link: there is no destination, and
              a link to the page you are on is a trap for a screen reader. */}
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Previous page" className={cn(linkBase, "hover:bg-muted")}>
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          ) : (
            <span aria-hidden className={cn(linkBase, "opacity-40")}>
              <ChevronLeft className="size-4" strokeWidth={2} />
            </span>
          )}

          {windowed(page, pageCount).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                key={p}
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  linkBase,
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {p}
              </Link>
            ),
          )}

          {page < pageCount ? (
            <Link href={href(page + 1)} aria-label="Next page" className={cn(linkBase, "hover:bg-muted")}>
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
            </Link>
          ) : (
            <span aria-hidden className={cn(linkBase, "opacity-40")}>
              <ChevronRight className="size-4" strokeWidth={2} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
