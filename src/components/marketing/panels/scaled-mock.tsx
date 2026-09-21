"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a product mock at its real design width and shrinks it to fit.
 *
 * The alternative — authoring the mock small, with `text-[11px]` and hand-picked
 * paddings — produces something that only resembles the product. Every panel in
 * here is built with the same `text-sm` / `p-5` / `rounded-2xl` scale the app
 * actually ships, and this scales the finished thing down like a screenshot, so
 * the proportions are the product's rather than an approximation of them.
 *
 * The scale is written straight onto the inner element's `transform` instead of
 * a custom property on the wrapper: a variable set on a parent invalidates
 * style for the entire subtree, and these panels have a few hundred nodes.
 * One transform write touches one element.
 */
export function ScaledMock({
  width,
  height,
  children,
  className,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;

    const apply = (w: number) => {
      innerEl.style.transform = `scale(${w / width})`;
    };
    apply(outerEl.clientWidth);

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) apply(w);
    });
    ro.observe(outerEl);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={outer}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      // The mock is decorative furniture around the real copy in each section.
      // Exposing a full fake dashboard to a screen reader would bury the page's
      // actual content under a few hundred meaningless nodes.
      aria-hidden
    >
      <div
        ref={inner}
        className="absolute top-0 left-0 origin-top-left"
        style={{ width, height, transform: "scale(1)" }}
      >
        {children}
      </div>
    </div>
  );
}
