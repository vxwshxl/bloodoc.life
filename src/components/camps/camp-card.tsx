import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { campDateParts, formatTimeRange } from "@/lib/format";
import type { Camp } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type CampFields = Pick<Camp, "title" | "starts_at" | "ends_at" | "venue" | "city">;

/**
 * The date block, a rule, then the title, time and place.
 *
 * One layout for a camp everywhere it appears as a card — the public list, the
 * home page, the donor's dashboard, the console's rosters and the partner
 * panel — so a camp is recognisable by shape before it is read. Pages add what
 * is theirs through `badge` (top right) and `children` (under the details);
 * they do not restyle the card.
 *
 * No hooks, so it renders on the server. `CampSummary` is the same body
 * without the link, for cards that carry their own controls.
 */
export function CampSummary({
  camp,
  badge,
  children,
}: {
  camp: CampFields;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const d = campDateParts(camp.starts_at);
  return (
    <span className="flex min-w-0 flex-1 items-start gap-4">
      {/* Tabular numerals: the day is the largest glyph on the card, and
          proportional digits make 25 and 11 sit at different widths. */}
      <span className="flex w-12 shrink-0 flex-col items-center">
        <span
          className="font-display text-3xl leading-none font-black tracking-tighter text-primary"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {d.day}
        </span>
        <span className="mt-1 text-[0.625rem] font-bold tracking-[0.14em] text-foreground">
          {d.month}
        </span>
        <span className="text-[0.625rem] text-muted-foreground">{d.year}</span>
      </span>

      <span aria-hidden className="w-px self-stretch bg-app-line-soft" />

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-display block text-base leading-tight font-bold tracking-tight text-balance">
            {camp.title}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
        </span>
        <span className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          <span className="flex items-start gap-1.5">
            <CalendarDays className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            {d.weekday} · {formatTimeRange(camp.starts_at, camp.ends_at)}
          </span>
          <span className="flex items-start gap-1.5">
            <MapPin className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            <span className="min-w-0">{[camp.venue, camp.city].filter(Boolean).join(", ")}</span>
          </span>
        </span>
        {children}
      </span>
    </span>
  );
}

/** A camp card that is a link. `action` is the call to action under it. */
export function CampCard({
  camp,
  href,
  action,
  badge,
  children,
  className,
}: {
  camp: CampFields;
  href: string;
  action?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/card press grain flex cursor-pointer rounded-2xl border border-app-line-soft bg-card p-5 shadow-card transition-[border-color] select-none hover:border-primary/40",
        className,
      )}
    >
      <CampSummary camp={camp} badge={badge}>
        {children}
        {action && (
          <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
            {action}
            <ArrowRight
              className="size-3.5 transition-transform duration-300 ease-out-strong group-hover/card:translate-x-0.5"
              strokeWidth={2.2}
              aria-hidden
            />
          </span>
        )}
      </CampSummary>
    </Link>
  );
}

/** The small uppercase tag a card wears top right: a role, a countdown. */
export function CampTag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase",
        tone === "primary" ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
