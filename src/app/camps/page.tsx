import type { Metadata } from "next";
import Link from "next/link";
import { getUpcomingCamps } from "@/lib/camps/queries";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { Live } from "@/components/shell/live";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { countdownLabel } from "@/lib/format";
import { CampCard, CampTag } from "@/components/camps/camp-card";

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
      {/* The camp on this page can be edited, published or pulled from the
          console at any moment, including while somebody is reading it. This
          redraws the page when that happens. */}
      <Live tables={["camps"]} />
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
            <div className="grid gap-4 sm:grid-cols-2">
              {camps.map((camp) => (
                <CampCard
                  key={camp.id}
                  camp={camp}
                  href={`/camps/${camp.slug}`}
                  action="Details and registration"
                  badge={<CampTag tone="primary">{countdownLabel(camp.starts_at)}</CampTag>}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
