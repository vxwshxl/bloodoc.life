"use client";

import { useCallback, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LayoutDashboard, Sparkles, Users } from "lucide-react";
import { BrowserFrame } from "@/components/marketing/device";
import { ScaledMock } from "@/components/marketing/panels/scaled-mock";
import { MOCK_W, MOCK_H } from "@/components/marketing/panels/shell";
import { OverviewPanel } from "@/components/marketing/panels/overview-panel";
import { RosterPanel } from "@/components/marketing/panels/roster-panel";
import { AssistantPanel } from "@/components/marketing/panels/assistant-panel";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    id: "overview",
    icon: LayoutDashboard,
    label: "Camp day",
    title: "The morning, on one screen",
    body:
      "Registered, screened, donated, deferred — counted as it happens, next to the units collected by group. The organiser stops asking the desk for a number and starts reading it.",
    points: ["Live counts", "Units by blood group", "Who is at the desk right now"],
    url: "bloodoc.life/admin",
    Panel: OverviewPanel,
  },
  {
    id: "roster",
    icon: Users,
    label: "Roster",
    title: "Everyone who is coming, and what they need",
    body:
      "Filter by group, department or status. A donor who registered in March arrives in September with their group, their count and last time's blood pressure already on the row.",
    points: ["Filter by group or department", "Screening recorded per visit", "Deferrals kept, not deleted"],
    url: "bloodoc.life/admin/registrations",
    Panel: RosterPanel,
  },
  {
    id: "assistant",
    icon: Sparkles,
    label: "Assistant",
    title: "Ask the roster a question",
    body:
      "“Who is O-negative and has given before?” “Draft a reminder for tomorrow.” It reads the camp you are standing in and nothing else — the tools it is given cannot address another organiser's data.",
    points: ["Answers from your own records", "Drafts the email, you send it", "Scoped by the tools, not by a prompt"],
    url: "bloodoc.life/admin/assistant",
    Panel: AssistantPanel,
  },
] as const;

/**
 * The console walkthrough: a rail of steps on one side, one sticky preview on
 * the other that follows whichever step you are reading.
 *
 * A sticky preview rather than a preview per step is the whole point — three
 * app mocks inlined down the page would be three times the DOM, and the reader
 * would scroll past each before it finished arriving. Here the screen stays put
 * and the content changes under the reading position, which is what makes this
 * read as one product rather than three screenshots.
 *
 * Panels mount on first visit and stay mounted, so a step's entrance animations
 * play once — when you first arrive — and later passes are clean crossfades.
 */
export function ConsoleTimeline() {
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState<number[]>([0]);
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);

  const select = useCallback((i: number) => {
    setActive(i);
    setVisited((v) => (v.includes(i) ? v : [...v, i]));
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Reduced motion still gets a working walkthrough — the steps stay
      // clickable, the rail simply does not track the scroll.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const triggers = gsap.utils.toArray<HTMLElement>("[data-step]").map((el, i) =>
          ScrollTrigger.create({
            trigger: el,
            // The band between 65% and 35% of the viewport is roughly where the
            // eye sits while reading. Switching on entry to the top of the
            // screen would change the preview a beat before the reader reaches
            // the words explaining it.
            start: "top 65%",
            end: "bottom 35%",
            onToggle: ({ isActive }) => {
              if (isActive) select(i);
            },
          }),
        );

        const line = progress.current;
        const fill =
          line &&
          ScrollTrigger.create({
            trigger: root.current,
            start: "top 60%",
            end: "bottom 60%",
            scrub: 0.4,
            onUpdate: ({ progress: p }) => {
              line.style.transform = `scaleY(${p})`;
            },
          });

        return () => {
          triggers.forEach((t) => t.kill());
          fill?.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  const current = STEPS[active];

  return (
    <div
      ref={root}
      className="mt-16 flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16"
    >
      {/*
        Which element carries `sticky` differs by breakpoint, and it has to.
        Sticky is bounded by its *parent's* box, and on a phone this column is a
        flex item exactly as tall as the frame inside it — so a sticky child has
        a couple of hundred pixels of travel and then scrolls away with
        everything else. On mobile the column itself sticks, bounded by the flex
        container that spans the whole walkthrough; on desktop the column is a
        grid cell already as tall as the rail beside it, so the inner element
        can stick.
      */}
      <div className="order-1 max-lg:sticky max-lg:top-36 max-lg:z-10 lg:order-2">
        <div className="lg:sticky lg:top-32">
          {/* An opaque bleed behind the frame so rail items scroll *under* the
              sticky preview on a phone rather than showing through its shadow.
              It has to clear the top of the screen, not just the frame: the nav
              island is translucent and floats 16px down, so a heading passing
              behind it stays legible through the glass. */}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -top-40 bottom-0 -z-10 bg-background lg:hidden"
          />
          <BrowserFrame url={current.url}>
            <div className="relative grid *:[grid-area:1/1]">
              {STEPS.map(({ id, Panel }, i) =>
                visited.includes(i) ? (
                  <div
                    key={id}
                    data-off={i === active ? undefined : ""}
                    className="transition-[opacity,filter] duration-300 ease-out-strong data-off:pointer-events-none data-off:opacity-0 data-off:blur-[6px]"
                  >
                    <ScaledMock width={MOCK_W} height={MOCK_H}>
                      <Panel />
                    </ScaledMock>
                  </div>
                ) : null,
              )}
            </div>
          </BrowserFrame>
        </div>
      </div>

      <ol className="relative order-2 lg:order-1">
        <span aria-hidden className="absolute top-2 bottom-2 left-[0.9375rem] w-px bg-border" />
        <span
          ref={progress}
          aria-hidden
          className="absolute top-2 bottom-2 left-[0.9375rem] w-px origin-top scale-y-0 bg-primary"
        />

        {STEPS.map((step, i) => {
          const isActive = i === active;
          return (
            <li key={step.id} data-step className="relative pb-14 pl-14 last:pb-0">
              <button
                type="button"
                onClick={() => select(i)}
                aria-current={isActive ? "step" : undefined}
                className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 flex size-8 items-center justify-center rounded-full border transition-colors duration-300 ease-out-strong",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <step.icon className="size-4" strokeWidth={2} />
                </span>

                <span className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {step.label}
                </span>

                <h3
                  className={cn(
                    "mt-2 text-2xl font-bold tracking-tight transition-colors duration-300 ease-out-strong sm:text-3xl",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </h3>

                <p className="mt-3 leading-relaxed text-muted-foreground">{step.body}</p>

                <span className="mt-4 flex flex-wrap gap-2">
                  {step.points.map((p) => (
                    <span
                      key={p}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-300 ease-out-strong",
                        isActive
                          ? "border-primary/30 bg-primary/8 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {p}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
