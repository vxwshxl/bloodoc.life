import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The home page with no camp leading it.
 *
 * Not `HeroScroll` with an empty card. That component pins the viewport for
 * roughly three screen-heights and drives a timeline around the camp card — so
 * with nothing to animate, a reader's first three flicks of the scroll wheel
 * moved nothing at all, waiting for a sequence whose subject did not exist.
 * The animation is the camp's introduction; with no camp there is nothing to
 * introduce, so the section is skipped and the page simply starts.
 *
 * Deliberately the same headline, copy and buttons as the pinned version, so
 * the two do not read as different sites.
 */
export function PlainHero({ dashboardHref }: { dashboardHref?: string | null }) {
  return (
    <section className="relative flex flex-col items-center justify-center px-5 pt-36 pb-20 text-center sm:px-6 sm:pt-44 sm:pb-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />

      <div className="relative">
        <span className="flex items-center justify-center gap-4 text-[0.6875rem] font-semibold tracking-[0.16em] text-primary uppercase sm:text-xs sm:tracking-[0.2em]">
          <span aria-hidden className="h-px w-8 bg-primary/40 max-sm:hidden" />
          Blood donation camps
          <span aria-hidden className="h-px w-8 bg-primary/40 max-sm:hidden" />
        </span>

        <h1 className="mt-6 max-w-5xl text-[2rem] leading-[1.08] font-bold tracking-tight sm:mt-8 sm:text-6xl sm:leading-[1.02] lg:text-7xl">
          Roll up a sleeve,
          <br />
          <span className="relative inline-block text-primary">
            save three lives.
            <span
              aria-hidden
              className="glow-rule absolute -bottom-1 left-0 h-[0.09em] w-full rounded-full sm:-bottom-2"
            />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:mt-8 sm:text-lg">
          One donation is separated into red cells, plasma and platelets. Three
          patients, out of one hour of your morning.
        </p>

        {/* No camp is being advertised, so the honest call to action is the
            list rather than a register button pointing at nothing. */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="group h-11 rounded-full px-6 text-sm">
            <Link href="/camps">
              See upcoming camps
              <ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-sm">
            <Link href={dashboardHref ?? "/eligibility"}>
              {dashboardHref ? "Your dashboard" : "Can I give blood?"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
