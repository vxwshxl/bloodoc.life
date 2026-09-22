/**
 * What a console page looks like while its rows are being fetched.
 *
 * There was nothing here before, which is a bigger part of "the console feels
 * slow" than any query is. Without a `loading.tsx` a navigation shows the page
 * you are leaving, unchanged and unresponsive, until the server answers — so a
 * 300ms fetch reads as a click that did not register, and the honest instinct
 * is to click again.
 *
 * Shaped like the page it replaces rather than a spinner: the header block sits
 * where the heading will, the bars where the rows will. That is what stops the
 * layout jumping when the real content lands, and it is why this is worth more
 * than a centred spinner despite being more code.
 *
 * `motion-reduce:animate-none` because a pulsing grid is exactly the kind of
 * thing somebody turns that setting on to avoid.
 */
function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      style={style}
      className={`block animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div aria-hidden className="rounded-2xl border border-app-line-soft bg-card shadow-card">
      <div className="flex items-center gap-4 border-b border-app-line-soft bg-(--table-head) px-5 py-3">
        {Array.from({ length: cols }, (_, i) => (
          <Bar key={i} className="h-3 flex-1 opacity-60" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 border-b border-app-line-soft px-5 py-4 last:border-b-0"
        >
          {Array.from({ length: cols }, (_, c) => (
            <Bar
              key={c}
              // Uneven widths, because a grid of identical bars reads as a
              // loading graphic and a ragged one reads as text about to appear.
              className={c === 0 ? "h-4 flex-[1.6]" : "h-3 flex-1"}
              // Deterministic, not random: a skeleton that reshuffles on every
              // render flickers during streaming.
              style={{ opacity: 1 - ((r + c) % 3) * 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The whole page: heading, the filter row, then the table. */
export function PageSkeleton({ rows, cols }: { rows?: number; cols?: number }) {
  return (
    <>
      <div className="mb-7">
        <Bar className="h-8 w-64" />
        <Bar className="mt-3 h-3.5 w-40 opacity-70" />
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Bar className="h-9 w-full max-w-md" />
        <Bar className="h-9 w-24" />
      </div>
      <TableSkeleton rows={rows} cols={cols} />
    </>
  );
}
