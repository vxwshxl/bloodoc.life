"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Inline-SVG charts for the console. Deliberately dependency-free — a charting
 * library would be the largest thing in the admin bundle for three small
 * figures, and everything here paints with the theme tokens so light and dark
 * are one implementation rather than two.
 *
 * On colour, deliberately: neither breakdown below uses a categorical palette.
 * Blood group and registration status are both read as *magnitude* — "which is
 * the biggest bar" — not as identities matched across charts. A single hue
 * ramped by value answers that without asking a reader to tell eight hues
 * apart, which is the case colour-vision deficiency breaks first. Status keeps
 * its reserved colours (donated, deferred) and always carries a text label, so
 * identity is never colour alone.
 */

export type SeriesPoint = {
  label: string;
  value: number;
  /**
   * An explicit bar colour, as a CSS value.
   *
   * A value on the datum, not a `tone(point)` callback. The callback version
   * read better and could not work: these charts are Client Components and the
   * pages rendering them are Server Components, so a function prop is not
   * serializable and React refuses the tree at runtime —
   *
   *   Functions cannot be passed directly to Client Components…
   *     <... data={[...]} tone={function tone}>
   *
   * Neither `tsc` nor the production build catches it, because a function prop
   * is perfectly valid TypeScript; only rendering the page does.
   */
  color?: string;
};

function ChartEmpty({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}

/**
 * Registrations over time: a single-series area + line.
 *
 * One series means no legend — the card title names it. A viewBox-based chart
 * scales to any container without a resize observer.
 */
export function TrendChart({
  data,
  height = 220,
  label = "registrations",
}: {
  data: SeriesPoint[];
  height?: number;
  label?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <ChartEmpty height={height} message="Nothing in this range yet." />;
  }

  const W = 720;
  const H = height;
  const PAD = { top: 14, right: 12, bottom: 26, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...data.map((d) => d.value));
  // A single point would divide by zero; centre it instead.
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;
  const x = (i: number) => PAD.left + (data.length > 1 ? i * stepX : plotW / 2);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;

  // Four gridlines is enough structure without competing with the data.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ t, v: Math.round(max * t) }));
  // Thin out x labels so they never collide, whatever the bucket count.
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const point = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} over time`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map(({ t, v }) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--app-line-soft)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 4}
              textAnchor="end"
              fill="currentColor"
              className="text-muted-foreground"
              style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}
            >
              {v}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair and marker for the hovered bucket. */}
        {point && hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--app-line)"
              strokeWidth={1}
            />
            {/* A 2px surface ring so the marker reads against the area fill. */}
            <circle cx={x(hover)} cy={y(point.value)} r={5} fill="var(--card)" />
            <circle cx={x(hover)} cy={y(point.value)} r={3.5} fill="var(--primary)" />
          </>
        )}

        {data.map((d, i) => (
          <text
            key={`${d.label}-${i}`}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fill="currentColor"
            className="text-muted-foreground"
            style={{ fontSize: 11 }}
          >
            {i % labelEvery === 0 ? d.label : ""}
          </text>
        ))}

        {/* Hit targets: full-height columns, wider than the marks, so the
            tooltip is reachable without landing exactly on a 3px dot. */}
        {data.map((d, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - (stepX || plotW) / 2}
            y={PAD.top}
            width={stepX || plotW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {point && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-app-line-soft bg-card px-2.5 py-1.5 text-xs shadow-card"
          style={{ left: `${((x(hover!) - 40) / W) * 100}%` }}
        >
          <p className="font-semibold tabular-nums">
            {point.value} {label}
          </p>
          <p className="text-muted-foreground">{point.label}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Horizontal bars for a breakdown.
 *
 * Horizontal rather than vertical because the categories are words — blood
 * groups, statuses — and a vertical layout either rotates them or truncates
 * them. 4px rounded data-ends anchored to the baseline; the value is direct-
 * labelled because there are few enough bars that a value axis would be more
 * ink for less information.
 */
export function BreakdownBars({
  data,
  className,
}: {
  data: SeriesPoint[];
  className?: string;
}) {
  if (data.length === 0) {
    return <ChartEmpty height={160} message="Nothing to show yet." />;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <li key={d.label} className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3">
            <span className="truncate text-xs font-medium text-muted-foreground">{d.label}</span>
            {/* The track carries a faint fill so a zero-value row is still a
                row rather than an empty line the eye skips. */}
            <span className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(pct, d.value > 0 ? 3 : 0)}%`,
                  // Single hue, stepped by rank: the darkest bar is the
                  // largest. Opacity rather than five hand-picked steps keeps
                  // it correct for any number of rows.
                  background:
                    d.color ??
                    `color-mix(in oklch, var(--primary) ${Math.round(45 + (pct / 100) * 55)}%, transparent)`,
                }}
              />
            </span>
            <span
              className="text-right text-xs font-semibold"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.value}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A headline number. Not a chart — one figure does not need a plot. */
export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "font-display mt-1 text-3xl font-bold tracking-tight",
          accent && "text-primary",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
