import { getNextCamp } from "@/lib/camps/queries";
import { getCampPartners } from "@/lib/partners/queries";
import { getDashboardHref } from "@/lib/auth/dal";
import { siteStructuredData } from "@/lib/seo/structured-data";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
import { RevealFooter } from "@/components/marketing/reveal-footer";
import { HeroScroll } from "@/components/marketing/hero-scroll";
import { MarqueeBand } from "@/components/marketing/marquee-band";
import { ImpactBand } from "@/components/marketing/impact-band";
import { HowBand } from "@/components/marketing/how-band";
import { EligibilityBand } from "@/components/marketing/eligibility-band";
import { ConsoleSection } from "@/components/marketing/console-section";
import { TeamBand } from "@/components/marketing/team-band";
import { CtaBand } from "@/components/marketing/cta-band";

/**
 * The BlooDoc home page.
 *
 * Server component by default — the copy, the structured data and every section
 * below the hero are static, so they render once on the server and ship as
 * HTML. Only the pieces that genuinely need the client are client components:
 * the smooth-scroll bridge, the pinned hero, the console walkthrough and the
 * counters. The page is fully readable before any of them hydrate, which
 * matters more here than on most sites: somebody checking where the camp is
 * from a bus is on the worst connection this page will ever see.
 */
export default async function HomePage() {
  const [camp, dashboardHref] = await Promise.all([getNextCamp(), getDashboardHref()]);
  // Sequential on purpose: the partner rows are keyed on the camp's id, which
  // the call above is what produces.
  const partners = camp ? await getCampPartners(camp.id) : null;
  const jsonLd = siteStructuredData(camp);

  return (
    <>
      {/* `overflow-x-clip` rather than `overflow-x-hidden`: clip does not create
          a scroll container, so the pinned hero and every sticky child keep
          working, while the decorative layers that deliberately bleed past the
          content width — the blooms, the oversized wordmark, the tilted
          marquees — can never put a horizontal scrollbar on a phone.

          `z-10` and an opaque background are what let RevealFooter work: the
          page has to paint over the pinned footer, and the footer has to be a
          sibling rather than a child, because `overflow-x-clip` here would clip
          a fixed descendant. */}
      <main id="top" className="relative z-10 flex flex-1 flex-col overflow-x-clip bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <SmoothScroll />
        <TopNav overlay dashboardHref={dashboardHref} />

        <HeroScroll camp={camp} partners={partners} />
        <MarqueeBand />
        <ImpactBand />
        <HowBand />
        <EligibilityBand />
        <ConsoleSection />
        <TeamBand />
        <CtaBand />
      </main>

      <RevealFooter>
        <SiteFooter />
      </RevealFooter>
    </>
  );
}
