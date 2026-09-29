import { cn } from "@/lib/utils";

/**
 * The BlooDoc mark: a drop, and inside it a heart with a cross, held in two
 * cupped hands.
 *
 * Inline SVG rather than an <img>: it is drawn at 20px in the assistant, 36px
 * in the nav and 56px on the error pages, and a raster mark has to ship at
 * each size to look right at all of them. The drop keeps its own gradient in
 * every theme — it is the brand, not a piece of UI, and a drop that goes pale
 * in dark mode stops reading as blood.
 *
 * The same drawing is in public/brand/logo.svg and public/icon.svg. Change
 * one, change all three, then run `node scripts/render-icons.mjs`.
 */
export function DropMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-9 shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* A single id would collide the moment two marks render on one page
            (nav + footer), and the second one would resolve the gradient
            against the first's stops. The id is scoped per instance instead. */}
        <linearGradient id="bd-drop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4443C" />
          <stop offset="0.55" stopColor="#C41F22" />
          <stop offset="1" stopColor="#8E1418" />
        </linearGradient>
      </defs>
      <path
        d="M16 1.6c.52 0 .95.23 1.24.63C20.1 6.1 26.6 14.3 26.6 19.7a10.6 10.6 0 0 1-21.2 0c0-5.4 6.5-13.6 9.36-17.47.29-.4.72-.63 1.24-.63Z"
        fill="url(#bd-drop)"
      />
      {/* The hands: tapered, thick at the palm and fine at the fingertips,
          so at 16px they still read as cupping rather than as a bowl. */}
      <path
        d="M9.5 15.9C7.9 20.9 10.9 25.6 15.4 26.3v-1.75C12.3 23.8 10 20.6 9.5 15.9ZM22.5 15.9c1.6 5-1.4 9.7-5.9 10.4v-1.75c3.1-.75 5.4-3.95 5.9-8.65Z"
        fill="#fff"
      />
      <path
        d="M16 23.1c-3.9-2.5-5.5-4.8-5.2-6.8.3-2 2.7-2.9 4.3-1.6l.9.8.9-.8c1.6-1.3 4-.4 4.3 1.6.3 2-1.3 4.3-5.2 6.8Z"
        fill="#fff"
      />
      <path d="M15.3 16.4h1.4v1.3H18v1.4h-1.3v1.3h-1.4v-1.3H14v-1.4h1.3Z" fill="#C41F22" />
    </svg>
  );
}

/** "BLOODOC" as the logo sets it. Shared with the console rail. */
export function WordmarkText({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[1.0625rem] leading-none font-extrabold tracking-tight uppercase",
        className,
      )}
    >
      Blood<span className="text-primary">oc</span>
    </span>
  );
}

/** The mark alone, sized for chrome. */
export function Logo({ className }: { className?: string }) {
  return <DropMark className={className} />;
}

/**
 * Mark + name, set as the logo is: BLOOD in ink, OC in crimson, heavy caps.
 * One element, not two spans with a gap — a kerned wordmark that breaks across
 * a flex gap is the first thing to look wrong when the nav contracts.
 *
 * The DOM shape (mark, then a column of name and tagline) is relied on by the
 * top nav, which hides the tagline by position. Keep it.
 */
export function Wordmark({
  className,
  subtle = false,
}: {
  className?: string;
  subtle?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <DropMark />
      <span className="flex flex-col leading-none">
        <WordmarkText />
        <span
          className={cn(
            "text-[11px] tracking-wide",
            subtle ? "text-sidebar-foreground/60" : "text-muted-foreground",
          )}
        >
          give blood, give life
        </span>
      </span>
    </span>
  );
}
