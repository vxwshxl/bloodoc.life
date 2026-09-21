import { HeartPulse, ShieldCheck, Timer } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { CountUp } from "@/components/marketing/count-up";

/**
 * Why one person should bother, stated as numbers.
 *
 * Every figure here is a fact about blood, not a claim about this site: a unit
 * separates into three components, the interval between whole-blood donations
 * is 56 days, the donation itself takes about ten minutes, and India's annual
 * shortfall is a published number. That distinction matters — a marketing page
 * for a medical activity that inflates its own results is the fastest way to
 * lose the reader who is deciding whether to trust the desk.
 */
const STATS: { to: number; suffix?: string; label: string; note: string }[] = [
  { to: 3, label: "patients", note: "helped by one donation, once it is separated" },
  { to: 10, suffix: " min", label: "on the couch", note: "of an appointment that runs about an hour" },
  { to: 56, label: "days", note: "between whole-blood donations — that is all" },
  { to: 0, label: "substitutes", note: "have ever been manufactured. It only comes from people" },
];

const ASSURANCES = [
  {
    icon: ShieldCheck,
    title: "A fresh, sterile kit for every donor",
    body:
      "Needle, tubing and bag are single-use and opened in front of you. Giving blood cannot give you an infection — the one fear worth naming out loud.",
  },
  {
    icon: Timer,
    title: "You are screened before anything happens",
    body:
      "Haemoglobin, blood pressure, weight and a short history. If today is not your day the officer says so, it is recorded, and you come back to the next camp.",
  },
  {
    icon: HeartPulse,
    title: "Your body replaces it",
    body:
      "Plasma volume is back within a day or two and red cells within a few weeks. Eat, drink water, and skip the gym until the evening.",
  },
];

export function ImpactBand() {
  return (
    <section id="impact" className="relative overflow-hidden px-6 py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-y" />

      <div className="relative mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Why it matters
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            It is an hour. For someone else it is the rest of their life.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Blood cannot be manufactured and it does not keep for long — red
            cells last about six weeks, platelets five days. Which means a blood
            bank is never stocked; it is only ever being refilled.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 60} className="bg-card p-7">
              <p className="font-display text-5xl font-bold tracking-tighter text-primary">
                <CountUp to={s.to} />
                {s.suffix}
              </p>
              <p className="mt-2 text-sm font-semibold">{s.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.note}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {ASSURANCES.map((a, i) => (
            <Reveal
              key={a.title}
              delay={i * 70}
              className="rounded-2xl border border-border bg-card p-7 shadow-card"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <a.icon className="size-5.5" strokeWidth={1.9} />
              </span>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{a.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
