import { Marquee } from "@/components/marketing/marquee";

const TOP = [
  "Whole blood",
  "Red cells",
  "Plasma",
  "Platelets",
  "O negative",
  "Thalassaemia",
  "Trauma",
  "Surgery",
  "Childbirth",
];

const BOTTOM = [
  "One donation, three patients",
  "Fifty-six days between donations",
  "Ten minutes on the couch",
  "No substitute has ever been made",
  "Your group is always needed",
  "Screening is free",
];

/**
 * Two counter-rotating bands between the hero and the argument.
 *
 * The tilt is what makes it read as a band rather than a second navigation bar,
 * and the opposite directions stop the two rows being mistaken for one tall
 * block sliding — the shear between them is the whole effect.
 *
 * The rows also run at different speeds. Two marquees at matched speed drift
 * into visible lockstep within seconds, and the pattern that emerges is far
 * more distracting than either row on its own.
 */
export function MarqueeBand() {
  return (
    <div aria-hidden className="relative isolate -my-6 overflow-hidden py-14">
      <div className="-rotate-2">
        <Marquee
          items={TOP}
          duration={44}
          className="mask-fade-x border-y border-border bg-card/60 py-4"
          itemClassName="text-lg font-semibold tracking-tight sm:text-xl"
        />
      </div>
      <div className="mt-4 rotate-1">
        <Marquee
          items={BOTTOM}
          duration={58}
          reverse
          className="mask-fade-x border-y border-border bg-primary/5 py-3.5"
          itemClassName="text-sm font-medium tracking-[0.12em] text-muted-foreground uppercase sm:text-base"
        />
      </div>
    </div>
  );
}
