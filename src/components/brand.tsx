import { cn } from "@/lib/utils";

/**
 * The BlooDoc mark: a drop with a pulse through it.
 *
 * Inline SVG rather than an <img>, for two reasons. It is drawn at 32px in the
 * nav and at 56px in the footer, and a raster mark has to ship twice to look
 * right at both; and the pulse line is `currentColor`, so the mark sits on the
 * crimson tile in the chrome and on a white card in an email footer without a
 * second file. The drop itself keeps its own gradient in every theme — it is
 * the brand, not a piece of UI, and a drop that goes pale in dark mode stops
 * reading as blood.
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
        d="M16 2.2c.5 0 .9.22 1.18.6C19.9 6.5 26 14.2 26 19.3A10 10 0 0 1 6 19.3C6 14.2 12.1 6.5 14.82 2.8c.28-.38.68-.6 1.18-.6Z"
        fill="url(#bd-drop)"
      />
      <path
        d="M9.2 20h2.9l1.7-4.4 2.7 8.1 1.9-3.7h4.4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The mark alone, sized for chrome. */
export function Logo({ className }: { className?: string }) {
  return <DropMark className={className} />;
}

/**
 * Mark + name. The "Blo" / "Doc" split is set in one element, not two spans
 * with a gap — a kerned wordmark that breaks across a flex gap is the first
 * thing to look wrong when the nav contracts.
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
        <span className="font-display text-base font-semibold tracking-tight">
          Bloo<span className="text-primary">Doc</span>
        </span>
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
