"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, ListFilter, Loader2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; hint?: string };

/**
 * A filter you add, rather than a row of every possible value.
 *
 * This replaced a strip of pills — one per camp — which was fine at two camps
 * and unusable at twenty: the strip wrapped to four lines, pushed the table off
 * the screen, and the one you wanted was somewhere in the middle of it. The
 * cost of a pill strip grows with the data; the cost of a menu does not.
 *
 * When nothing is selected this is a single icon button. When something is, it
 * becomes a chip naming the choice with its own clear button, so the active
 * filter is stated rather than implied by which pill happens to be tinted.
 *
 * Navigation rather than local state, for the same reason every list here is
 * paginated in the URL: a filtered roster is a link somebody sends to the
 * colleague running the desk.
 */
export function FilterMenu({
  label,
  paramName,
  options,
  active,
  align = "start",
}: {
  /** What is being filtered — "Camp", "Status". */
  label: string;
  paramName: string;
  options: FilterOption[];
  active?: string;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = options.find((o) => o.value === active);

  function apply(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(paramName, value);
    else next.delete(paramName);
    // Changing a filter always returns to the first page. Keeping the old page
    // number lands on an empty table whenever the new filter has fewer rows,
    // which reads as "no results" for a filter that has plenty.
    next.delete("page");
    const qs = next.toString();
    // `replace` inside a transition, and no scroll. Changing a filter is a
    // refinement of the list you are looking at, not a place you navigate to
    // and might want to come back from one step at a time — and the old
    // `push` left the page frozen with no feedback while the rows were
    // fetched, then jumped to the top of the document when they arrived.
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={current ? `${label}: ${current.label}` : `Filter by ${label.toLowerCase()}`}
            className={cn(
              "press inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm font-medium transition-colors",
              current
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-app-line bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {pending ? (
              <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={1.9} aria-hidden />
            ) : (
              <ListFilter className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
            )}
            <span className="max-w-44 truncate">{current ? current.label : label}</span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align} className="max-h-80 w-64 overflow-y-auto">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Filter by {label.toLowerCase()}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => apply(null)} className="gap-2">
            <Check className={cn("size-4 shrink-0", active ? "opacity-0" : "opacity-100")} />
            <span className="flex-1">All</span>
          </DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onSelect={() => apply(o.value)} className="gap-2">
              <Check
                className={cn("size-4 shrink-0", active === o.value ? "opacity-100" : "opacity-0")}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.hint && (
                  <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>
                )}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clearing is its own control rather than a trip back into the menu:
          removing a filter is the most common thing done to one. */}
      {current && (
        <button
          type="button"
          onClick={() => apply(null)}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="press flex size-9 shrink-0 items-center justify-center rounded-lg border border-app-line text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
