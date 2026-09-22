"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LayoutDashboard, LogIn } from "lucide-react";
import { SliderNav, type SliderNavItem } from "@/components/ui/slider-nav";
import { Wordmark } from "@/components/brand";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

// `flex-auto` overrides SliderNav's fluid `flex-1` for this nav only. Equal
// quarters of a 390px bar give the longest label fewer pixels than its text
// needs, so it truncates while a three-letter neighbour has room to spare.
// Sizing from content lets the short labels give space to the long one.
const ITEMS: SliderNavItem[] = [
  { href: "/", label: "Home", className: "flex-auto" },
  { href: "/camps", label: "Camps", className: "flex-auto" },
  { href: "/eligibility", label: "Can I give?", className: "flex-auto" },
  { href: "/faq", label: "FAQ", className: "flex-auto" },
];

/** Space kept between the bottom of the island and the footer's top edge. */
const FOOTER_GAP = 12;

/**
 * The public header: a floating island that contracts once the page has been
 * scrolled past its own height.
 *
 * The split of responsibilities is the point. ScrollTrigger decides *when* —
 * one callback pair at a single threshold, no per-frame work — and CSS decides
 * *how*, so the morph runs on the compositor even while the pinned hero has
 * GSAP busy on the main thread. Driving the width from a scrub would tie a
 * layout-affecting property to every scroll frame, which is the one thing worth
 * avoiding on this page.
 */
export function TopNav({
  activeIndex = 0,
  overlay = false,
  dashboardHref = null,
}: {
  /** Index into ITEMS; null for a page that is not in the nav. */
  activeIndex?: number | null;
  /** The signed-in visitor's console. Turns the CTA into "Dashboard". */
  dashboardHref?: string | null;
  /**
   * Let page content run underneath the bar. The landing hero is a full-height
   * stage designed to be overlaid; every other page starts with a heading that
   * would sit behind a fixed translucent island, so those get a spacer of the
   * bar's own height instead of each remembering to pad itself.
   */
  overlay?: boolean;
}) {
  const island = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);

  // The bar yields to the footer. Once the footer's top edge climbs up to the
  // island, the header is pushed up by the same amount, so it scrolls off with
  // the page instead of floating over the footer's heading. Scroll-locked and
  // one-to-one rather than a timed hide: it moves exactly as fast as the finger
  // does, and scrolling back up returns it the same way.
  //
  // The stop line is the first [data-nav-stop] in the document — the footer in
  // normal flow, or RevealFooter's spacer while the footer is pinned.
  useEffect(() => {
    const el = header.current;
    if (!el) return;
    let frame = 0;
    let shift = 0;

    const update = () => {
      frame = 0;
      const stop = document.querySelector("[data-nav-stop]");
      const edge = stop ? stop.getBoundingClientRect().top : Infinity;
      // offsetHeight ignores transforms, so this is the untranslated bottom.
      const next = Math.min(0, edge - el.offsetHeight - FOOTER_GAP);
      if (next === shift) return;
      shift = next;
      el.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : "";
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useGSAP(() => {
    const st = ScrollTrigger.create({
      // Roughly the island's own height: it fires once the bar has cleared the
      // top of the document, which is the moment it stops reading as part of
      // the hero and starts reading as an overlay needing its own ground.
      start: "top -88",
      end: 99999,
      onToggle: ({ isActive }) => {
        const el = island.current;
        if (!el) return;
        if (isActive) el.dataset.stuck = "";
        else delete el.dataset.stuck;
      },
    });
    return () => st.kill();
  });

  return (
    <>
      {!overlay && <div aria-hidden className="h-32 shrink-0 md:h-20" />}
      <header ref={header} className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-4">
        <div
          ref={island}
          data-nav-island
          className={cn(
            "group/nav pointer-events-auto mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 border border-transparent px-3 py-2",
            // Two rows on a phone, so it needs corners a pill cannot give it.
            "rounded-3xl md:flex-nowrap md:rounded-full",
            "transition-[max-width,background-color,border-color,box-shadow,backdrop-filter] duration-[400ms] ease-out-strong",
            "data-stuck:max-w-4xl data-stuck:border-border data-stuck:bg-card/75 data-stuck:shadow-lg data-stuck:backdrop-blur-xl",
            // Translucent from the first frame on a phone. On desktop the bar
            // earns its background by being scrolled past; here it sits
            // directly on the headline with nowhere else to go.
            "max-md:border-border max-md:bg-card/75 max-md:shadow-lg max-md:backdrop-blur-xl",
          )}
        >
          <Link
            href="/"
            aria-label="BlooDoc home"
            className="press order-1 shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {/* The tagline is the first thing to go when space runs short: it is
                hidden below lg, and again once the island contracts at any
                width. By then it has been on screen for a full viewport, and
                the mark alone still identifies the site. */}
            <Wordmark className="[&>span:last-child>span:last-child]:max-lg:hidden group-data-stuck/nav:[&>span:last-child>span:last-child]:hidden" />
          </Link>

          {/* Below md the nav drops to its own full-width row. Four labels plus
              a wordmark plus the controls cannot share 390px without one of
              them being cut off, and the one that gets cut is always the last
              link. A second row costs 40px and keeps every item reachable. */}
          <div className="order-3 w-full min-w-0 md:order-2 md:mx-auto md:w-auto">
            <SliderNav
              items={ITEMS}
              // Out of range, not -1: SliderNav clamps negatives to the first
              // tab, while an index past the end simply draws no pill.
              activeIndex={activeIndex ?? ITEMS.length}
              fluid
              tone="light"
              className="border border-border bg-card shadow-sm"
            />
          </div>

          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 md:order-3 md:ml-0">
            {dashboardHref ? (
              // Signed in: straight back to their console. Unlike "Register",
              // this one stays on phones as an icon, since it is the only way
              // back from here.
              <Link
                href={dashboardHref}
                className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:w-9 max-md:justify-center max-md:px-0"
              >
                <LayoutDashboard className="size-4 md:hidden" aria-hidden />
                <span className="max-md:sr-only">Dashboard</span>
              </Link>
            ) : (
              // Was `max-md:hidden`, which meant a phone had no way in at all —
              // the only route to /signin was typing it. It now collapses to an
              // icon exactly as Dashboard does, and sits in the same top row as
              // the wordmark rather than in the nav row below it.
              <Link
                href="/signin"
                aria-label="Sign in"
                className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-md:w-9 max-md:justify-center max-md:px-0"
              >
                <LogIn className="size-4 md:hidden" aria-hidden />
                <span className="max-md:sr-only">Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
