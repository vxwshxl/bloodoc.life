import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, MapPin, Users } from "lucide-react";
import { getCampBySlug } from "@/lib/camps/queries";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { RegisterForm } from "@/components/marketing/register-form";
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
    title: `${camp.title} — ${formatCampDate(camp.starts_at)}`,
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

        <div className="relative overflow-hidden px-6 pt-4 pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />
          <div className="relative mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
              {countdownLabel(camp.starts_at)}
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              {camp.title}
            </h1>
            {camp.summary && (
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{camp.summary}</p>
            )}

            <dl className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Date
                </dt>
                <dd className="mt-2 font-display text-xl font-bold tracking-tight">
                  {d.day} {d.month}
                </dd>
                <dd className="text-xs text-muted-foreground">{d.weekday}, {d.year}</dd>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Time
                </dt>
                <dd className="mt-2 flex items-center gap-2 text-sm font-medium">
                  <Clock className="size-4 shrink-0 text-primary" strokeWidth={1.9} />
                  {formatTimeRange(camp.starts_at, camp.ends_at)}
                </dd>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Venue
                </dt>
                <dd className="mt-2 flex items-start gap-2 text-sm font-medium">
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

        <div className="mx-auto w-full max-w-3xl px-6 pb-24">
          {camp.status === "closed" ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
              <p className="font-display text-xl font-bold tracking-tight">
                Registration for this camp is closed.
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                You can still walk in on the day if there is room — or look at
                what is coming next.
              </p>
            </div>
          ) : (
            <div className="grain rounded-3xl border border-border bg-card p-6 shadow-[var(--panel-shadow)] sm:p-9">
              <h2 className="font-display text-2xl font-bold tracking-tight">Register to donate</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Two minutes. You only ever fill this in once.
              </p>
              <div className="mt-7">
                <RegisterForm camp={camp} compact />
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
