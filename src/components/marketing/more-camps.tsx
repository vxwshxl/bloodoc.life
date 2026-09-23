import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampCard } from "@/components/camps/camp-card";
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
        {camps.map((c) => (
          <CampCard key={c.id} camp={c} href={`/camps/${c.slug}#register`} action="Register" />
        ))}
      </div>
    </section>
  );
}
