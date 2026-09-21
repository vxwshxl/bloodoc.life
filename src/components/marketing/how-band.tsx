"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ClipboardCheck, Coffee, Droplet, Stethoscope, UserCheck } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    icon: ClipboardCheck,
    minutes: "2 min",
    title: "You register",
    body: "The form on this page, once. It takes about two minutes and you never fill it again — the next camp already knows you.",
  },
  {
    icon: UserCheck,
    minutes: "5 min",
    title: "You check in",
    body: "Give your name at the desk. Your row is already there with your group and your last visit on it, so there is nothing to write out.",
  },
  {
    icon: Stethoscope,
    minutes: "10 min",
    title: "You are screened",
    body: "Haemoglobin, blood pressure, weight, and a short private conversation about your health and medication. The officer decides, and either answer is fine.",
  },
  {
    icon: Droplet,
    minutes: "10 min",
    title: "You donate",
    body: "About 350–450ml, on a couch, with a fresh sterile kit opened in front of you. Most of that time is you lying still rather than anything happening.",
  },
  {
    icon: Coffee,
    minutes: "15 min",
    title: "You sit, eat, and go",
    body: "Juice and a biscuit while you are watched for a quarter of an hour. Your record is updated before you stand up, and your certificate reaches your inbox.",
  },
];

/**
 * What happens on the day, as a sequence rather than a list.
 *
 * The rail is scrubbed, not revealed, and that is the whole design: five steps
 * are an *order*, and arriving at once turns them into bullet points. Letting
 * the reader draw the line at their own pace is what makes it read as a process
 * they are being walked through — which is the actual anxiety this section
 * exists to answer.
 *
 * `scrub: 0.8`, so a flick lets the line catch up rather than teleport.
 *
 * The steps light individually with `once: true` rather than from one shared
 * timeline: a step already on screen at load must not wait for a timeline
 * anchored above the fold.
 */
export function HowBand() {
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Rail pre-drawn, every step lit. The motion paced the sequence; it
        // never carried it.
        if (rail.current) rail.current.style.transform = "scaleY(1)";
        gsap.set("[data-how-step]", { opacity: 1, y: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const line = rail.current;
        const fill =
          line &&
          ScrollTrigger.create({
            trigger: root.current,
            start: "top 70%",
            end: "bottom 60%",
            scrub: 0.8,
            onUpdate: ({ progress }) => {
              line.style.transform = `scaleY(${progress})`;
            },
          });

        const steps = gsap.utils.toArray<HTMLElement>("[data-how-step]").map((el) =>
          gsap.fromTo(
            el,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              ease: "power2.out",
              scrollTrigger: { trigger: el, start: "top 80%", once: true },
            },
          ),
        );

        return () => {
          fill?.kill();
          steps.forEach((t) => {
            t.scrollTrigger?.kill();
            t.kill();
          });
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="how" className="relative overflow-hidden px-6 py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom-center" />

      <div ref={root} className="relative mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            What actually happens
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Forty minutes, start to finish.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Almost none of it is the needle. Here is the whole thing, in order,
            so nothing on the day is a surprise.
          </p>
        </div>

        <ol className="relative mt-14">
          <span aria-hidden className="absolute top-3 bottom-3 left-[1.4375rem] w-px bg-border" />
          <span
            ref={rail}
            aria-hidden
            className="absolute top-3 bottom-3 left-[1.4375rem] w-px origin-top scale-y-0 bg-primary"
          />

          {STEPS.map((s) => (
            <li
              key={s.title}
              data-how-step
              className="relative pb-12 pl-[4.5rem] last:pb-0 motion-safe:opacity-0"
            >
              <span
                aria-hidden
                className="absolute top-0 left-0 flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-card"
              >
                <s.icon className="size-5" strokeWidth={1.9} />
              </span>
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-xl font-bold tracking-tight sm:text-2xl">{s.title}</h3>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {s.minutes}
                </span>
              </div>
              <p className="mt-2.5 leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
