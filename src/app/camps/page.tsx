import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getUpcomingCamps } from "@/lib/camps/queries";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { campDateParts, formatTimeRange, countdownLabel } from "@/lib/format";

export const metadata: Metadata = pageMetadata({
  title: "Upcoming blood donation camps",
  description:
    "Every BlooDoc blood donation camp still to come: date, time, venue and how many places are left. Registration takes two minutes and is free.",
  path: "/camps",
});

export default async function CampsPage() {
  const [camps, dashboardHref] = await Promise.all([getUpcomingCamps(), getDashboardHref()]);

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <TopNav activeIndex={1} dashboardHref={dashboardHref} />

        <div className="relative overflow-hidden px-5 pt-4 pb-10 sm:px-6 sm:pb-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />
          <div className="relative mx-auto max-w-4xl">
            <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Camps
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Where to find us next.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Registering takes two minutes and costs nothing. You can also walk
              in on the day. The form just means less queueing.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl px-5 pb-20 sm:px-6 sm:pb-24">
          {camps.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-card">
              <p className="font-display text-xl font-bold tracking-tight">
                Nothing on the calendar right now.
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Camps are usually announced three to four weeks ahead. Leave your
                details and we will write to you the day the next one is fixed.
              </p>
              <Link
                href="/signin"
                className="press mt-7 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                Tell me when
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {camps.map((camp) => {
                const d = campDateParts(camp.starts_at);
                return (
                  <li key={camp.id}>
                    <Link
                      href={`/camps/${camp.slug}`}
                      className="group press grain flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-card transition-[border-color] duration-300 ease-out-strong hover:border-primary/40 sm:flex-row sm:items-center sm:gap-7 sm:p-6"
                    >
                      <span className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-0">
                        <span
                          className="font-display text-5xl leading-none font-black tracking-tighter text-primary"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {d.day}
                        </span>
                        <span className="flex flex-col sm:mt-1 sm:items-center">
                          <span className="text-sm font-bold tracking-[0.14em]">
                            {d.month} {d.year}
                          </span>
                          <span className="text-xs text-muted-foreground">{d.weekday}</span>
                        </span>
                      </span>

                      <span aria-hidden className="hidden w-px self-stretch bg-border sm:block" />

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2.5">
                          <span className="font-display text-lg font-bold tracking-tight">
                            {camp.title}
                          </span>
                          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary">
                            {countdownLabel(camp.starts_at)}
                          </span>
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{formatTimeRange(camp.starts_at, camp.ends_at)}</span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-3.5" strokeWidth={1.9} />
                            {[camp.venue, camp.city].filter(Boolean).join(", ")}
                          </span>
                        </span>
                      </span>

                      <ArrowRight
                        className="size-5 shrink-0 text-primary transition-transform duration-300 ease-out-strong group-hover:translate-x-1"
                        strokeWidth={2.2}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
