import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { campDateParts, formatTimeRange } from "@/lib/format";
import type { Camp } from "@/lib/db/types";

/**
 * Every listed camp after the one the hero leads with.
 *
 * `camps.listed` is documented as "show on the home page and the /camps list",
 * and until now the home page honoured only the first of them — `getNextCamp`
 * takes `.limit(1)`, so marking a second camp listed changed nothing visible
 * and the toggle quietly lied. The hero still leads with the next one, because
 * a page with two equally-weighted hero cards has no lead; the rest appear
 * here.
 *
 * Renders nothing at all when there is only one camp, so a site running a
 * single drive looks exactly as it did.
 */
export function MoreCamps({ camps }: { camps: Camp[] }) {
  if (camps.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Also coming up
          </p>
          <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {camps.length} more camp{camps.length === 1 ? "" : "s"} on the calendar
          </h2>
        </div>
        <Link
          href="/camps"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          See all camps
          <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {camps.map((c) => {
          const d = campDateParts(c.starts_at);
          return (
            <Link
              key={c.id}
              href={`/camps/${c.slug}#register`}
              className="group/card press grain flex cursor-pointer items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--panel-shadow)] transition-[border-color] select-none hover:border-primary/40"
            >
              <span className="flex shrink-0 flex-col items-center">
                <span
                  className="font-display text-3xl leading-none font-black tracking-tighter text-primary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {d.day}
                </span>
                <span className="mt-1 text-[0.625rem] font-bold tracking-[0.14em] text-foreground">
                  {d.month}
                </span>
              </span>

              <span aria-hidden className="w-px self-stretch bg-border" />

              <span className="min-w-0 flex-1">
                <span className="font-display block text-base leading-tight font-bold tracking-tight text-balance">
                  {c.title}
                </span>
                <span className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                  <span className="flex items-start gap-1.5">
                    <CalendarDays className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                    {d.weekday} · {formatTimeRange(c.starts_at, c.ends_at)}
                  </span>
                  <span className="flex items-start gap-1.5">
                    <MapPin className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                    <span className="min-w-0">
                      {c.venue}
                      {c.city ? `, ${c.city}` : ""}
                    </span>
                  </span>
                </span>
                <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  Register
                  <ArrowRight
                    className="size-3.5 transition-transform duration-300 ease-out-strong group-hover/card:translate-x-0.5"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
