import type { Metadata } from "next";
import Link from "next/link";
import { getDashboardHref } from "@/lib/auth/dal";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { Reveal } from "@/components/marketing/reveal";
import { FAQ } from "@/lib/faq";
import { faqStructuredData } from "@/lib/seo/structured-data";
import { pageMetadata } from "@/lib/seo/page-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Blood donation questions, answered",
  description:
    "Does it hurt, how long does it take, who can donate, how often, what about medication or a tattoo. The questions people actually ask before giving blood for the first time.",
  path: "/faq",
});

export default async function FaqPage() {
  const dashboardHref = await getDashboardHref();
  const jsonLd = faqStructuredData(FAQ);

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TopNav activeIndex={3} dashboardHref={dashboardHref} />

        <div className="relative overflow-hidden px-5 pt-4 pb-10 sm:px-6 sm:pb-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />
          <div className="relative mx-auto max-w-3xl">
            <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Questions
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Everything people ask before their first time.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Straight answers, including the ones about pain and weakness that
              everybody thinks and nobody says out loud.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-5 pb-20 sm:px-6 sm:pb-24">
          {/* <details> rather than a JS accordion: it opens before hydration,
              it is findable by the browser's own Find on page (Chrome expands a
              closed <details> to reach a match), and it prints open. */}
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={Math.min(i, 6) * 40} as="div">
                <details className="group">
                  <summary className="flex cursor-pointer items-start gap-4 px-4 py-4 text-left font-semibold tracking-tight sm:px-7 sm:py-5">
                    <span className="flex-1">{item.q}</span>
                    <span
                      aria-hidden
                      className="mt-1 flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-transform duration-300 ease-out-strong group-open:rotate-45"
                    >
                      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                      </svg>
                    </span>
                  </summary>
                  <p className="px-4 pb-5 leading-relaxed text-muted-foreground sm:px-7 sm:pb-6">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-muted-foreground">
            Still unsure?{" "}
            <Link href="/eligibility" className="font-medium text-foreground underline underline-offset-4">
              Read the eligibility list
            </Link>{" "}
            or{" "}
            <a href="mailto:hello@bloodoc.life" className="font-medium text-foreground underline underline-offset-4">
              write to us
            </a>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
