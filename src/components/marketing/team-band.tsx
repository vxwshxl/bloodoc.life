import { Reveal } from "@/components/marketing/reveal";
import { TEAM, initialsOf } from "@/lib/team";
import { cn } from "@/lib/utils";

/**
 * Who is behind it.
 *
 * On a site asking strangers for a unit of their blood, an unsigned page is a
 * liability: "who are these people" is a fair question and the answer should
 * not require a search. Named, with roles, above the final call to action.
 *
 * The phone layout is 2 then 3, not a 2-2-1 grid. The first row is the two
 * founders and the second is the three officers, which is the shape of the
 * team; a plain two-column grid split that into "two founders / one founder and
 * an officer / one officer", grouping people who have nothing to do with each
 * other and leaving a half-empty last row.
 *
 * Monograms rather than photographs, deliberately: five headshots taken at five
 * different times in five different rooms never sit together on a row, and a
 * placeholder avatar reads worse than no avatar at all. When there are five
 * real, consistent portraits, this is the component to change.
 */
export function TeamBand() {
  const founders = TEAM.filter((m) => m.founder);
  const officers = TEAM.filter((m) => !m.founder);

  return (
    <section id="team" className="relative overflow-hidden px-5 py-16 sm:px-6 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-y" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Who is behind it
          </span>
          <h2 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:mt-6 sm:text-5xl">
            Real names, on the record.
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
            You are being asked for a unit of your blood and a page of your
            medical history. The least we can do is tell you who is asking.
          </p>
        </Reveal>

        {/*
          Two rows on a phone, one on a laptop. `grid-cols-6` is what lets the
          same list do both: two halves of six, then three thirds of six, and at
          `lg` every card takes one fifth and the row spans are ignored.
        */}
        <ul className="mt-10 grid grid-cols-6 gap-3 sm:mt-14 sm:gap-4 lg:grid-cols-5">
          {[...founders, ...officers].map((member, i) => (
            <Reveal
              key={member.name}
              as="li"
              delay={Math.min(i, 5) * 60}
              className={cn(
                "group/member relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-card px-3 py-6 text-center shadow-card transition-colors duration-300 ease-out-strong hover:border-primary/40 sm:px-4 sm:py-8",
                i < founders.length ? "col-span-3" : "col-span-2",
                "sm:col-span-2 lg:col-span-1",
              )}
            >
              {/* A crimson wash that lifts on hover. Cheaper than a shadow
                  change and it does not move the card, which on a five-across
                  row would nudge its neighbours. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/8 to-transparent opacity-0 transition-opacity duration-300 ease-out-strong group-hover/member:opacity-100"
              />

              <span
                aria-hidden
                className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-bold tracking-tight text-primary ring-1 ring-primary/15 sm:size-16 sm:text-xl"
              >
                {initialsOf(member.name)}
              </span>

              {/* Role above the name: it is what the eye is scanning a row of
                  five people for. */}
              <span className="relative mt-5 text-[0.625rem] font-semibold tracking-[0.14em] text-primary uppercase sm:text-[0.6875rem]">
                {member.role}
              </span>
              <span className="relative mt-1.5 font-display text-sm leading-tight font-bold tracking-tight text-balance sm:text-base">
                {member.name}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
