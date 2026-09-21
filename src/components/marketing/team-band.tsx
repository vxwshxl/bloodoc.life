import { Reveal } from "@/components/marketing/reveal";
import { TEAM, initialsOf } from "@/lib/team";

/**
 * Who is behind it.
 *
 * On a site asking strangers for a unit of their blood, an unsigned page is a
 * liability — "who are these people" is a fair question and the answer should
 * not require a search. Named, with roles, above the final call to action.
 *
 * Monograms rather than photographs, deliberately: five headshots taken at
 * five different times in five different rooms never sit together on a row,
 * and a placeholder avatar reads worse than no avatar at all. When there are
 * five real, consistent portraits, this is the component to change.
 */
export function TeamBand() {
  return (
    <section id="team" className="relative px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Who is behind it
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Real names, on the record.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            You are being asked for a unit of your blood and a page of your
            medical history. The least we can do is tell you who is asking.
          </p>
        </Reveal>

        <ul className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {TEAM.map((member, i) => (
            <Reveal
              key={member.name}
              as="li"
              delay={Math.min(i, 5) * 60}
              className="flex flex-col items-center bg-card px-4 py-8 text-center"
            >
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 font-display text-lg font-bold tracking-tight text-primary"
              >
                {initialsOf(member.name)}
              </span>
              {/* Role above the name: it is what the eye is scanning a row of
                  five people for. */}
              <span className="mt-5 text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
                {member.role}
              </span>
              <span className="mt-1.5 font-display text-base leading-tight font-bold tracking-tight text-balance">
                {member.name}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
