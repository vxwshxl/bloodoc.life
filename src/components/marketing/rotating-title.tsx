"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 3500;

/**
 * A title that cycles through its own translations, sliding upward.
 *
 * Three details are load-bearing.
 *
 * **It stacks rather than swaps.** All the titles occupy one grid cell, so the
 * box is as tall as the tallest of them and the layout never reflows mid-cycle
 * — which matters more than usual here, because Assamese and Devanagari have
 * taller ascenders and descenders than Latin and would each resize an <h1>
 * every 3.5 seconds, shunting the whole page up and down.
 *
 * **The outgoing line leaves upward and the incoming one arrives from below.**
 * That needs the previous index as well as the current one; with a single
 * "active / not active" class the inactive lines all share one position and the
 * old title slides back the way the new one came, which reads as a stutter.
 *
 * **Under reduced motion it does not rotate at all.** A heading that rewrites
 * itself every few seconds is precisely the kind of unrequested movement the
 * setting exists to stop, and a static English title loses nothing that
 * matters. The other languages stay in the markup, so a crawler still finds
 * them.
 *
 * For assistive technology the whole thing is one label, spoken once. A live
 * region announcing a new title every 3.5 seconds would make the page unusable
 * with a screen reader, and the rotation is presentation: the heading has not
 * changed, only which language it is written in.
 */
export function RotatingTitle({
  titles,
  className,
  itemClassName,
}: {
  /** English first. It is the accessible name and the reduced-motion fallback. */
  titles: string[];
  className?: string;
  itemClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    if (titles.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      setIndex((current) => {
        setPrevious(current);
        return (current + 1) % titles.length;
      });
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [titles.length]);

  if (titles.length === 0) return null;

  return (
    // `items-center`: the box is as tall as the longest title, and a shorter
    // one sitting at the top of it leaves what reads as a stray gap under the
    // heading. Centred, the line simply occupies the middle of a box whose
    // height never changes.
    <span
      aria-label={titles[0]}
      className={cn("grid items-center *:[grid-area:1/1]", className)}
    >
      {titles.map((title, i) => (
        <span
          key={title}
          aria-hidden
          className={cn(
            "transition-[opacity,translate] duration-[600ms] ease-out-strong motion-reduce:transition-none",
            i === index
              ? "translate-y-0 opacity-100"
              : i === previous
                // Out through the top.
                ? "-translate-y-[0.45em] opacity-0"
                // Waiting below, ready to come up.
                : "translate-y-[0.45em] opacity-0",
            itemClassName,
          )}
        >
          {title}
        </span>
      ))}
    </span>
  );
}
