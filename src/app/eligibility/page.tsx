import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardHref } from "@/lib/auth/dal";
import { getNextCamp } from "@/lib/camps/queries";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { EligibilityBand } from "@/components/marketing/eligibility-band";
import { Reveal } from "@/components/marketing/reveal";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { formatCampDate } from "@/lib/format";

export const metadata: Metadata = pageMetadata({
  title: "Can I give blood?",
  description:
    "Who can donate blood in India: age, weight, the three-month interval, and what medication, a tattoo, pregnancy, a cold or recent surgery actually mean. Most things that stop you stop you for weeks, not for good.",
  path: "/eligibility",
});

/**
 * The long-form eligibility page.
 *
 * It reuses `EligibilityBand` — the same three columns the home page shows —
 * rather than restating the rules in different words. Two versions of a medical
 * list is two versions to keep correct, and the one that goes stale is always
 * the one nobody remembers exists.
 */
const DEFERRALS = [
  { what: "Whole blood donation", wait: "3 months" },
  { what: "Platelet (apheresis) donation", wait: "48 hours" },
  { what: "Cold, flu or any fever", wait: "Until fully recovered, usually 1–2 weeks" },
  { what: "Course of antibiotics", wait: "2 weeks after the last dose" },
  { what: "Tattoo, piercing or acupuncture", wait: "6 months" },
  { what: "Major dental work", wait: "1 month" },
  { what: "Minor dental work or a scaling", wait: "24 hours" },
  { what: "Surgery under general anaesthetic", wait: "6 months" },
  { what: "Blood transfusion", wait: "6 months" },
  { what: "Pregnancy", wait: "12 months after delivery" },
  { what: "Miscarriage or termination", wait: "6 months" },
  { what: "While breastfeeding", wait: "Until the child is weaned" },
  { what: "Vaccination (routine, inactivated)", wait: "Usually none — mention it at screening" },
  { what: "Malaria", wait: "3 months after full recovery" },
  { what: "Typhoid", wait: "12 months after recovery" },
];

export default async function EligibilityPage() {
  const [dashboardHref, camp] = await Promise.all([getDashboardHref(), getNextCamp()]);

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col overflow-x-clip bg-background">
        <TopNav activeIndex={2} dashboardHref={dashboardHref} />

        <div className="relative overflow-hidden px-6 pt-4 pb-4">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />
          <div className="relative mx-auto max-w-3xl">
            <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Eligibility
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Can I give blood?
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Almost certainly, and probably sooner than you think. Here is the
              whole picture — including how long each of the common reasons for
              waiting actually lasts.
            </p>
          </div>
        </div>

        <EligibilityBand />

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                How long each wait actually is
              </h2>
              <p className="mt-5 leading-relaxed text-muted-foreground">
                These are the general Indian guidelines. The medical officer at
                the camp works from the current national standards and from what
                you tell them on the day, so treat this as a good guide and their
                answer as the decision.
              </p>
            </Reveal>

            <Reveal delay={80} className="mt-9 overflow-hidden rounded-2xl border border-border bg-card">
              {/* Reflows to stacked blocks below `sm` rather than being a table
                  in a horizontal scroller. One DOM, not a duplicate mobile
                  list — a second block would read the whole thing twice to a
                  screen reader. */}
              <table className="w-full text-left text-sm max-sm:block">
                <thead className="max-sm:hidden">
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:px-7">
                      After
                    </th>
                    <th className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:px-7">
                      You can give again
                    </th>
                  </tr>
                </thead>
                <tbody className="max-sm:block">
                  {DEFERRALS.map((d) => (
                    <tr
                      key={d.what}
                      className="border-b border-border last:border-b-0 max-sm:block max-sm:px-5 max-sm:py-4"
                    >
                      <td className="px-5 py-3.5 font-medium max-sm:block max-sm:p-0 sm:px-7">
                        {d.what}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground max-sm:mt-1 max-sm:block max-sm:p-0 sm:px-7">
                        {d.wait}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>

            <Reveal
              delay={120}
              className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-6"
            >
              <p className="font-display text-lg font-bold tracking-tight">
                Not sure? Come anyway.
              </p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                Screening is free, takes ten minutes, and tells you your
                haemoglobin, your blood pressure and your group. Being deferred
                is recorded and costs you nothing — you simply come to the next
                one.
              </p>
              <Link
                href={camp ? `/camps/${camp.slug}` : "/camps"}
                className="press mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                {camp ? `Register for ${formatCampDate(camp.starts_at)}` : "See upcoming camps"}
              </Link>
            </Reveal>

            <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
              BlooDoc is not a medical provider and this page is not medical
              advice. Nothing here clears anyone to donate blood; only the
              medical officer at a camp can do that.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
