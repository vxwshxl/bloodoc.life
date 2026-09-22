"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** How long to wait after the last keystroke before asking the server. */
const DEBOUNCE_MS = 250;

/**
 * The console's one search input.
 *
 * It filters on the server — across the whole table rather than across the
 * twenty-five rows that happen to be on screen — and it keeps the term in the
 * URL, so a filtered roster stays a link the desk can reload and send to a
 * colleague. Both of those were true before and neither has changed.
 *
 * What changed is that it no longer *navigates*. It used to be a GET form: you
 * typed, you pressed Search, the browser left the page and came back with a new
 * one. Every search cost a full document load, and the only feedback in between
 * was the tab spinner.
 *
 * Now the box is local state — so typing is instant, with nothing between the
 * key and the character — and a debounced `router.replace` updates the query
 * string underneath. Next re-renders the Server Component and streams the new
 * rows into the existing page: the shell, the scroll position and the focus in
 * this very input all survive. `useTransition` is what makes the wait visible
 * rather than frozen; `replace` rather than `push` keeps twelve keystrokes from
 * becoming twelve entries in the back button.
 *
 * Still a real `<form>`, so it submits and works with JavaScript off — the
 * progressive-enhancement story the GET form had is intact, it is just no
 * longer the fast path.
 */
export function SearchBox({
  placeholder,
  defaultValue,
  /** Other query params to preserve, e.g. `{ camp: campId }`. */
  keep,
  /** Where the no-JavaScript clear link goes — this page with no query. */
  clearHref,
  className,
}: {
  placeholder: string;
  defaultValue?: string;
  keep?: Record<string, string | undefined>;
  clearHref: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [value, setValue] = useState(defaultValue ?? "");

  // What the URL currently says, so a keystroke that lands back on the term
  // already applied does not fire a pointless refetch — which happens every
  // time somebody types a character and deletes it again.
  const applied = useRef(defaultValue ?? "");

  function commit(term: string) {
    if (term === applied.current) return;
    applied.current = term;

    const next = new URLSearchParams(params.toString());
    if (term) next.set("q", term);
    else next.delete("q");
    // A new search always starts at page one. Keeping the old page number
    // lands on an empty table whenever the new term has fewer matches, which
    // reads as "nothing found" for a search that found plenty.
    next.delete("page");

    const qs = next.toString();
    startTransition(() => {
      // `scroll: false`: the results are under the box you are typing in, and
      // jumping to the top of the document on every keystroke is disorienting
      // in a way that is hard to name and impossible to work with.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Debounced. Every keystroke would otherwise be a database query, and the
  // answers would arrive out of order — "arn" landing after "arnab" and
  // replacing the right rows with stale ones.
  useEffect(() => {
    const id = setTimeout(() => commit(value.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `commit` is recreated every render and is a pure function of things the
    // hooks below already track; keying on the text is what this is about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Somebody else changed the URL — the back button, a filter chip, a live
  // refresh. Follow it, unless they are mid-word in this box.
  useEffect(() => {
    const term = defaultValue ?? "";
    if (term !== applied.current) {
      applied.current = term;
      setValue(term);
    }
  }, [defaultValue]);

  function clear() {
    setValue("");
    // Clears the search and nothing else. The X used to be a link to
    // `clearHref`, which dropped every other filter with it — so clearing the
    // name you had typed also un-picked the camp whose roster you were on.
    // `clearHref` is now only the no-JavaScript fallback.
    commit("");
  }

  return (
    <form
      // Enter should not reload the page now that the term is already applied;
      // it flushes the debounce instead, for somebody who types fast and
      // expects Enter to mean "now".
      onSubmit={(e) => {
        e.preventDefault();
        commit(value.trim());
      }}
      className={cn("flex max-w-md flex-1 items-center gap-2", className)}
    >
      {/* Kept for the no-JavaScript submit, which is still a plain GET. */}
      {Object.entries(keep ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="relative flex-1">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          {pending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.9} aria-hidden />
          ) : (
            <Search className="size-4" strokeWidth={1.9} aria-hidden />
          )}
        </span>
        <input
          name="q"
          // Not `type="search"`: that draws the browser's own clear button,
          // which does not fire a change event on every engine — so clearing
          // with it emptied the box and left the results filtered. Ours is the
          // X beside it.
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-busy={pending || undefined}
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-app-line bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="press flex size-9 shrink-0 items-center justify-center rounded-lg border border-app-line text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>
      )}
      {/* Only for the no-JavaScript case. With scripts on, the term is applied
          before a hand could reach either of these, so they would be two
          controls that never do anything. */}
      <noscript>
        <a
          href={clearHref}
          className="press flex h-9 shrink-0 items-center rounded-lg border border-app-line px-3 text-sm text-muted-foreground"
        >
          Clear
        </a>
        <button
          type="submit"
          className="press h-9 shrink-0 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </noscript>
    </form>
  );
}
