import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, Users } from "lucide-react";
import { getCampBySlug } from "@/lib/camps/queries";
import { getCampPartners } from "@/lib/partners/queries";
import { partnerDisplay } from "@/lib/partners/display";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { RegisterForm } from "@/components/marketing/register-form";
import { RotatingTitle } from "@/components/marketing/rotating-title";
import { Live } from "@/components/shell/live";
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
  // Keyed on the camp's id, so this cannot join the Promise.all above.
  const partnerRows = camp ? await getCampPartners(camp.id) : null;
  // A draft is a camp nobody outside the console should know exists, so it is a
  // 404 rather than a "not yet published" page — which would confirm it exists.
  if (!camp || camp.status === "draft") notFound();

  const d = campDateParts(camp.starts_at);
  const jsonLd = campEvent(camp);
  const bodies = partnerDisplay(camp, partnerRows);

  return (
    <>
      {/* The camp on this page can be edited, published or pulled from the
          console at any moment, including while somebody is reading it. This
          redraws the page when that happens. */}
      <Live tables={["camps", "registrations"]} />
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
              One card, three rows on a phone and three columns from `sm`.

              Each fact gets its own line rather than sharing one: at 390px the
              single-line version could only fit by scrolling sideways, which
              hid the venue behind a swipe nobody was told about. Stacked, all
              three are readable without touching anything.

              From `sm` there is width for them to sit side by side, so they do,
              and the row dividers become column dividers. It stays one card
              either way: three separate bordered boxes in a row is more chrome
              than content for three short facts.
            */}
            <dl className="mt-5 grid divide-y divide-border rounded-2xl border border-border bg-card sm:mt-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <dt className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Date
                </dt>
                <dd className="mt-1 font-display text-base font-bold tracking-tight sm:text-lg">
                  {d.day} {d.month}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {d.weekday}, {d.year}
                </dd>
              </div>

              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <dt className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Time
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-semibold sm:text-base">
                  <Clock className="size-4 shrink-0 text-primary" strokeWidth={1.9} />
                  {formatTimeRange(camp.starts_at, camp.ends_at)}
                </dd>
              </div>

              <div className="px-4 py-3 sm:px-5 sm:py-4">
                <dt className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Venue
                </dt>
                <dd className="mt-1 flex items-start gap-2 text-sm font-semibold sm:text-base">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.9} />
                  <span>
                    {camp.venue}
                    {camp.city ? `, ${camp.city}` : ""}
                  </span>
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

        {(bodies.collaborators.length > 0 || bodies.bloodBanks.length > 0) && (
          <div className="mx-auto grid w-full max-w-3xl gap-4 px-5 pb-24 sm:grid-cols-2 sm:px-6">
            {bodies.collaborators.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  In collaboration with
                </p>
                {bodies.collaborators.map((b) => (
                  <div key={b.name} className="mt-1.5">
                    <p className="font-semibold">{b.name}</p>
                    {b.note && <p className="text-sm text-muted-foreground">{b.note}</p>}
                  </div>
                ))}
              </div>
            )}
            {bodies.bloodBanks.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {bodies.bloodBanks.length > 1 ? "Blood bank partners" : "Blood bank partner"}
                </p>
                {bodies.bloodBanks.map((b) => (
                  <div key={b.name} className="mt-1.5">
                    <p className="font-semibold">{b.name}</p>
                    {b.note && <p className="text-sm text-muted-foreground">{b.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
