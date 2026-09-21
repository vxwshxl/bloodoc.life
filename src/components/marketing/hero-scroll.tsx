"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight, CalendarCheck, Droplet, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/marketing/event-card";
import { FloatCard } from "@/components/marketing/float-card";
import { campDateParts } from "@/lib/format";
import type { Camp } from "@/lib/db/types";

gsap.registerPlugin(ScrollTrigger);

const COPY_TITLE = "One record. Every camp.";
const COPY_BODY =
  "You fill the form once. Your group, your last donation and what you are taking carry to every camp after it — so the desk already knows you, and the only queue left is the one for the needle.";

const CARDS = {
  collected: { icon: Droplet, title: "171 units collected", detail: "25 Sept · by 2pm" },
  matched: { icon: HeartPulse, title: "O− donor found", detail: "Called in 4 minutes" },
  reminded: { icon: CalendarCheck, title: "248 reminders sent", detail: "Camp roster · yesterday" },
} as const;

/**
 * The pinned hero.
 *
 * The section stays fixed for roughly three viewport heights while the scroll
 * drives one timeline: the headline hands off to the camp card, the card
 * settles, and the supporting copy and activity cards arrive around it. Pinning
 * is what makes a single continuous gesture read as one story rather than four
 * sections that happen to follow each other.
 *
 * Three decisions worth naming:
 *
 * `scrub: 1` rather than `true`. A hard scrub welds the timeline to the
 * scrollbar, so a trackpad flick snaps the card to full size in one frame. The
 * one-second catch-up lets it arrive under its own momentum, which is the whole
 * reason for driving this from scroll instead of a button.
 *
 * The headline leaves on blur, not opacity alone. Two full-contrast layers
 * crossfading at hero size is where a crossfade looks most like two objects;
 * the blur collapses them into one transition.
 *
 * `gsap.matchMedia` owns every breakpoint and the reduced-motion case, and GSAP
 * reverts each context when its query stops matching — so resizing from desktop
 * to phone tears down the pin and the transforms it wrote rather than leaving a
 * half-applied desktop timeline behind.
 */
export function HeroScroll({ camp, registered }: { camp: Camp | null; registered?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const date = camp ? campDateParts(camp.starts_at) : null;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Reduced motion: no pin, no scrub, nothing driven by scroll position.
      // The section becomes an ordinary stacked hero and everything is visible
      // from the first frame — the content never needed the scroll, only the
      // choreography did.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Explicit values rather than `clearProps: "all"`. clearProps strips
        // every inline style GSAP has written — including the `opacity: 1` set
        // in this very call — which would drop the copy and the float cards
        // back to their `opacity-0` classes and leave the section blank for
        // exactly the people who cannot see it animate in.
        gsap.set(".hero-intro, .hero-card, .hero-copy, .hero-copy-m, .hero-float, .hero-float-m", {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          xPercent: 0,
          filter: "none",
        });
      });

      mm.add(
        {
          // Three cases, not two. A tablet is not a big phone here: it has room
          // to show the card at its natural size in the middle of the stage the
          // way the desktop does, and the phone treatment at 768px would put an
          // oversized card straight over the headline.
          isDesktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          isTablet:
            "(min-width: 640px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)",
          isPhone: "(max-width: 639px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { isDesktop, isPhone } = ctx.conditions as {
            isDesktop: boolean;
            isTablet: boolean;
            isPhone: boolean;
          };

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: isPhone ? "+=180%" : "+=280%",
              pin: ".hero-stage",
              pinSpacing: true,
              scrub: 1,
              // Cheap insurance against the mobile URL bar resizing the
              // viewport mid-pin and shifting every measurement under it.
              invalidateOnRefresh: true,
              // Measure this pin before every other trigger on the page. A
              // breakpoint change rebuilds this timeline, so the pin is created
              // after the sections below already have their triggers; refreshed
              // in creation order those were measured without the pin's spacer
              // and would sit about a screen too high.
              refreshPriority: 1,
            },
          });

          // 1 — the headline hands off.
          tl.to(
            ".hero-intro",
            {
              opacity: 0,
              scale: 0.94,
              y: isPhone ? -96 : -64,
              filter: "blur(10px)",
              ease: "power2.in",
              duration: 0.9,
            },
            0,
          );

          // 2 — the camp arrives. Hidden at rest, growing into the middle of the
          // stage as the headline leaves, on every breakpoint.
          tl.fromTo(
            ".hero-card",
            { opacity: 0, scale: 0.7, y: 120, filter: "blur(8px)" },
            { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", ease: "power2.out", duration: 1.4 },
            0.25,
          );

          if (isDesktop) {
            // 3 — the card gives up the centre so the copy has somewhere to be.
            tl.to(".hero-card", { xPercent: 20, scale: 0.86, ease: "power2.inOut", duration: 1 }, 1.7);
            tl.fromTo(
              ".hero-copy",
              { opacity: 0, x: -48, filter: "blur(8px)" },
              { opacity: 1, x: 0, filter: "blur(0px)", ease: "power2.out", duration: 1 },
              1.9,
            );
          }

          if (!isDesktop) {
            // Below lg there is no side column to slide into, so the same copy
            // is stacked under the card and simply rises into place.
            tl.fromTo(
              ".hero-copy-m",
              { opacity: 0, y: 24, filter: "blur(8px)" },
              { opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out", duration: 1 },
              1.7,
            );
          }

          // 4 — live activity settles around the card, one at a time. Desktop
          // orbits the stage; smaller screens use the set pinned to the card's
          // own corners, which is the only arrangement that fits.
          tl.fromTo(
            isDesktop ? ".hero-float" : ".hero-float-m",
            { opacity: 0, scale: 0.9, y: 28 },
            { opacity: 1, scale: 1, y: 0, ease: "back.out(1.4)", duration: 0.8, stagger: 0.18 },
            isDesktop ? 2.1 : 1.9,
          );

          // 5 — the wordmark drifts the whole way through, slowest layer on the
          // stage, which is what sells the depth.
          tl.fromTo(
            ".hero-wordmark",
            { xPercent: 8, opacity: 0 },
            { xPercent: -8, opacity: 1, ease: "none", duration: 3 },
            0.6,
          );

          // 6 — the stage dissolves just before the pin lets go. Without this
          // the sequence ends at full opacity and the whole tableau is dragged
          // off the top by ordinary scrolling, which undoes the illusion that
          // it was ever fixed. Fading the stage rather than its children,
          // because the wordmark is already running its own opacity tween and
          // two tweens on one property fight; a parent's opacity multiplies
          // through instead.
          tl.to(".hero-stage", { opacity: 0, ease: "power1.in", duration: 0.5 }, 3.5);
        },
      );

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="relative">
      {/* Under `prefers-reduced-motion` the pin never runs, so a stage of
          absolutely-positioned layers would collapse into one unreadable pile.
          The motion-safe / motion-reduce pairs below give that case a real
          layout — headline, then camp, then copy, in normal flow. Reduced
          motion is a different design, not a disabled one. */}
      <div className="hero-stage relative motion-safe:h-svh motion-safe:overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />

        <span
          aria-hidden
          className="hero-wordmark pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18vw] leading-none font-black tracking-tighter text-foreground/[0.035] select-none motion-reduce:hidden"
        >
          BLOODOC
        </span>

        {/* 1 — headline */}
        <div className="hero-intro z-20 flex flex-col items-center justify-center px-6 text-center sm:max-md:justify-start sm:max-md:pt-36 md:justify-center motion-safe:absolute motion-safe:inset-0 motion-reduce:static motion-reduce:pt-32 motion-reduce:pb-16">
          <span className="flex items-center gap-4 text-center text-[0.6875rem] font-semibold tracking-[0.16em] text-primary uppercase sm:text-xs sm:tracking-[0.2em]">
            <span aria-hidden className="h-px w-8 bg-primary/40 max-sm:hidden" />
            {date ? `${date.day} ${date.month} ${date.year} · ${camp?.city ?? "Guwahati"}` : "Blood donation camps"}
            <span aria-hidden className="h-px w-8 bg-primary/40 max-sm:hidden" />
          </span>

          {/* No `text-balance`. The line breaks are authored — the accented
              clause belongs on its own line — and the balancer re-wraps around
              an explicit <br/>, which is how a two-line headline becomes a
              ragged three. */}
          <h1 className="mt-6 max-w-6xl text-[2rem] leading-[1.08] font-bold tracking-tight sm:mt-8 sm:text-6xl sm:leading-[1.02] lg:text-[5.5rem]">
            Roll up a sleeve,
            <br />
            <span className="relative inline-block text-primary">
              save three lives.
              <span
                aria-hidden
                className="glow-rule absolute -bottom-1 left-0 h-[0.09em] w-full rounded-full sm:-bottom-2"
              />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:mt-8 sm:text-lg">
            One donation is separated into red cells, plasma and platelets —
            three patients, out of one hour of your morning.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 max-sm:hidden">
            <Button asChild size="lg" className="group h-11 rounded-full px-6 text-sm">
              <Link href="#camp">
                See the next camp
                <ArrowUpRight className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-sm">
              <Link href="/eligibility">Can I give blood?</Link>
            </Button>
          </div>
        </div>

        {/* 2 — the camp */}
        <div
          id="camp"
          className="z-10 flex items-center justify-center px-6 max-lg:flex-col max-lg:gap-10 max-lg:pt-24 max-sm:gap-9 motion-safe:absolute motion-safe:inset-0 motion-reduce:static motion-reduce:items-center motion-reduce:pb-16"
        >
          {/*
            Two elements, not one. The outer holds the resting pose and GSAP
            never touches it; `.hero-card` inside is GSAP's alone. Putting the
            width on the animated element makes two same-specificity utilities
            fight over `width`; putting an offset there is worse, because GSAP
            folds a CSS `translate` into its own transform matrix when it takes
            over an element and the resting offset is absorbed, then overwritten
            by the tween's first frame.
          */}
          <div className="relative w-full max-w-xl lg:max-w-2xl">
            {/*
              The starting opacity is in the markup, not only in the timeline.
              GSAP writes `opacity: 0` as an inline style, but only once the
              bundle has parsed and run — and the server-rendered HTML paints
              before that, so for a few hundred milliseconds after a reload the
              card sat at full size directly over the headline and then
              vanished. Declaring the same start state as a class means the
              first painted frame is already the one the timeline begins from.
            */}
            <div className="hero-card motion-safe:opacity-0">
              {camp ? (
                <EventCard camp={camp} registered={registered} />
              ) : (
                <div className="grain rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--panel-shadow)]">
                  <p className="font-display text-xl font-bold tracking-tight">
                    No camp on the calendar yet.
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    The next one is being arranged. Leave your details and we
                    will write to you the day it is fixed.
                  </p>
                  <Button asChild className="mt-6 h-10 rounded-full px-6">
                    <Link href="/signin">Tell me when</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Below lg the cards are pinned to the card, not the stage: a
                stage-relative position that clears a wide layout lands on the
                copy or off-screen on a phone. Offsets stay inside the
                container's gutter so nothing widens the page. */}
            <FloatCard
              {...CARDS.collected}
              compactOnPhone
              className="hero-float-m absolute -top-5 -right-2 z-30 lg:hidden motion-safe:opacity-0 motion-reduce:hidden sm:-right-4"
            />
            <FloatCard
              {...CARDS.matched}
              compactOnPhone
              className="hero-float-m absolute -bottom-6 -left-2 z-30 lg:hidden motion-safe:opacity-0 motion-reduce:hidden sm:-left-4"
            />
          </div>

          <div className="hero-copy-m pointer-events-none max-w-md text-center lg:hidden motion-safe:opacity-0">
            <h2 className="text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">
              {COPY_TITLE}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {COPY_BODY}
            </p>
          </div>
        </div>

        {/* 3 — supporting copy, desktop only */}
        <div className="hero-copy pointer-events-none z-20 hidden flex-col justify-center lg:flex motion-safe:absolute motion-safe:inset-y-0 motion-safe:left-0 motion-safe:w-1/3 motion-safe:pl-10 motion-safe:opacity-0 xl:motion-safe:pl-16 motion-reduce:mx-auto motion-reduce:max-w-3xl motion-reduce:px-6 motion-reduce:pb-28 motion-reduce:text-center">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-balance">
            {COPY_TITLE}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">{COPY_BODY}</p>
        </div>

        {/* 4 — live activity */}
        <FloatCard
          {...CARDS.collected}
          className="hero-float absolute top-[16%] left-[4%] z-30 max-lg:hidden motion-safe:opacity-0 motion-reduce:hidden"
        />
        <FloatCard
          {...CARDS.matched}
          className="hero-float absolute right-[5%] bottom-[18%] z-30 max-lg:hidden motion-safe:opacity-0 motion-reduce:hidden"
        />
        <FloatCard
          {...CARDS.reminded}
          className="hero-float absolute bottom-[12%] left-[6%] z-30 max-xl:hidden motion-safe:opacity-0 motion-reduce:hidden"
        />
      </div>
    </div>
  );
}
