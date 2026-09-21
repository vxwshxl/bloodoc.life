import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { getCampBySlug } from "@/lib/camps/queries";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { RegisterForm } from "@/components/marketing/register-form";
import { RotatingTitle } from "@/components/marketing/rotating-title";
import { campTitles } from "@/lib/camps/titles";
import { campEvent } from "@/lib/seo/structured-data";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { campDateParts, formatCampDate, formatTimeRange, countdownLabel } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const camp = await getCampBySlug(slug);
  if (!camp || camp.status !== "published") {
    return { title: "Camp not found", robots: { index: false, follow: false } };
  }
  // The date and the place go in the title, because that is what somebody types
  // and what an answer engine has to match to quote this page.
  return pageMetadata({
    title: `${camp.title}, ${formatCampDate(camp.starts_at)}`,
    description:
      camp.summary ??
      `Blood donation camp on ${formatCampDate(camp.starts_at)} at ${camp.venue}${camp.city ? `, ${camp.city}` : ""}. Free, takes about 40 minutes, register in two minutes.`,
    path: `/camps/${camp.slug}`,
  });
}

export default async function CampPage({ params }: Params) {
  const { slug } = await params;
  const [camp, dashboardHref] = await Promise.all([getCampBySlug(slug), getDashboardHref()]);
  // A draft is a camp nobody outside the console should know exists, so it is a
  // 404 rather than a "not yet published" page — which would confirm it exists.
  if (!camp || camp.status === "draft") notFound();

  const d = campDateParts(camp.starts_at);
  const jsonLd = campEvent(camp);

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TopNav activeIndex={1} dashboardHref={dashboardHref} />

        <div className="relative overflow-hidden px-5 pt-4 pb-10 sm:px-6 sm:pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />
          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
              {countdownLabel(camp.starts_at)}
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              <RotatingTitle titles={campTitles(camp)} />
            </h1>
            {camp.summary && (
              <p className="mt-5 leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
                {camp.summary}
              </p>
            )}

            {/*
              One horizontal strip, not three stacked blocks.

              Label and value sit side by side inside each segment and each
              segment sits beside the next, so the whole thing reads as a single
              line of "when and where" rather than as three cards to work
              through. The segments are divided by hairlines instead of being
              separate bordered boxes: three borders in a row at phone width is
              more chrome than content.

              Below `sm` the strip is one unbroken line that scrolls sideways.
              That is a real trade (the venue runs off the right edge until you
              swipe) and it is the right one here, because the alternative is
              either truncating the floor of the building somebody is
              navigating to, or going back to a stack that pushed the form off
              the screen. The scrollbar is hidden and the right edge is masked,
              so it reads as "there is more this way".

              From `sm` there is room to do it properly: nothing scrolls, the
              mask comes off, and the venue segment takes the remaining width
              and wraps inside itself. Keeping the phone's nowrap up here would
              push the venue out past the card's own border, since the three
              segments together are wider than the 3xl column.
            */}
            <dl className="scrollbar-none max-sm:mask-fade-x mt-5 flex items-stretch gap-4 overflow-x-auto rounded-2xl border border-border bg-card px-4 py-3 sm:mt-8 sm:gap-6 sm:overflow-x-visible sm:px-6 sm:py-4">
              <div className="flex shrink-0 items-baseline gap-2">
                <dt className="shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Date
                </dt>
                <dd className="flex items-baseline gap-1.5 text-sm font-semibold whitespace-nowrap">
                  {d.day} {d.month}
                  <span className="text-xs font-normal text-muted-foreground">
                    {d.weekday}, {d.year}
                  </span>
                </dd>
              </div>

              <span aria-hidden className="w-px shrink-0 self-stretch bg-border" />

              <div className="flex shrink-0 items-baseline gap-2">
                <dt className="shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Time
                </dt>
                <dd className="text-sm font-semibold whitespace-nowrap">
                  {formatTimeRange(camp.starts_at, camp.ends_at)}
                </dd>
              </div>

              <span aria-hidden className="w-px shrink-0 self-stretch bg-border" />

              <div className="flex shrink-0 items-baseline gap-2 pr-2 sm:min-w-0 sm:shrink sm:pr-0">
                <dt className="shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Venue
                </dt>
                <dd className="text-sm font-semibold whitespace-nowrap sm:whitespace-normal">
                  {camp.venue}
                  {camp.city ? `, ${camp.city}` : ""}
                </dd>
              </div>
            </dl>

            {camp.capacity && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" strokeWidth={1.9} />
                {camp.capacity} places
              </p>
            )}

          </div>
        </div>

        {/*
          The form, before anything else on the page.

          It used to sit under the collaboration and blood-bank cards, which put
          two screens of institutional detail between somebody who had just
          tapped "Register to donate" and the first field. Who is running the
          camp is worth saying; it is not worth saying before the thing the
          reader came to do. It is directly below now.

          `scroll-mt-32` is what makes the `#register` anchor land correctly
          when something does link to it: the header is fixed and translucent,
          so without a scroll margin the heading arrives underneath it.
        */}
        <div id="register" className="mx-auto w-full max-w-3xl scroll-mt-32 px-5 pb-16 sm:px-6 sm:pb-20">
          {camp.status === "closed" ? (
            <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card sm:p-8">
              <p className="font-display text-xl font-bold tracking-tight">
                Registration for this camp is closed.
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                You can still walk in on the day if there is room, or look at
                what is coming next.
              </p>
            </div>
          ) : (
            <div className="grain rounded-3xl border border-border bg-card p-5 shadow-[var(--panel-shadow)] sm:p-9">
              <h2 className="font-display text-2xl font-bold tracking-tight">Register as a Donor</h2>
              <div className="mt-6">
                <RegisterForm camp={camp} compact />
              </div>
            </div>
          )}
        </div>

        {(camp.collaboration || camp.partner_name) && (
          <div className="mx-auto grid w-full max-w-3xl gap-4 px-5 pb-24 sm:grid-cols-2 sm:px-6">
            {camp.collaboration && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  In collaboration with
                </p>
                <p className="mt-1.5 font-semibold">{camp.collaboration}</p>
              </div>
            )}
            {camp.partner_name && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Blood bank partner
                </p>
                <p className="mt-1.5 font-semibold">{camp.partner_name}</p>
                {camp.partner_note && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{camp.partner_note}</p>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
