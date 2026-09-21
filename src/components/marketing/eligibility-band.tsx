import { Check, Clock3, X } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";

/**
 * The three answers to "can I give blood?", side by side.
 *
 * Yes / wait / no rather than a checklist, because the honest shape of this
 * question is not "do you pass" — most people who think they cannot donate are
 * in the middle column, and telling them "come back in three months" keeps a
 * donor that a red cross would have lost.
 *
 * Every line here is a general Indian eligibility rule and is deliberately
 * hedged to what the medical officer decides. Nothing on this page clears
 * anybody.
 */
const COLUMNS = [
  {
    key: "yes",
    icon: Check,
    heading: "You can almost certainly give",
    tone: "border-primary/30 bg-primary/5",
    badge: "bg-primary text-primary-foreground",
    items: [
      "You are 18 to 65",
      "You weigh 45kg or more",
      "It has been 3 months since you last gave",
      "You feel well today and slept normally",
      "You are on routine medication like thyroxine or a statin",
      "You have a tattoo or piercing older than 6 months",
    ],
  },
  {
    key: "wait",
    icon: Clock3,
    heading: "Come to the next one",
    tone: "border-border bg-card",
    badge: "bg-muted text-foreground",
    items: [
      "You gave blood less than 3 months ago",
      "You have a cold, a fever or an infection right now",
      "You finished a course of antibiotics within 2 weeks",
      "You had a tattoo, piercing or major dental work within 6 months",
      "You are pregnant, or gave birth within the last year",
      "You had surgery or a transfusion within 6 months",
    ],
  },
  {
    key: "no",
    icon: X,
    heading: "Talk to us first",
    tone: "border-border bg-card",
    badge: "bg-destructive/12 text-destructive",
    items: [
      "You are being treated for a heart condition or cancer",
      "You have hepatitis B or C, or HIV",
      "You are on insulin",
      "You have had an unexplained fainting problem",
      "You are taking a blood thinner",
    ],
  },
] as const;

export function EligibilityBand() {
  return (
    <section id="eligibility" className="relative px-5 py-16 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Can I give?
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Most people who think they can&rsquo;t, can.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            The middle column is the one worth reading. Almost everything that
            stops you giving blood stops you for a few weeks, not for good.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {COLUMNS.map((col, i) => (
            <Reveal
              key={col.key}
              delay={i * 70}
              className={`rounded-2xl border p-5 shadow-card sm:p-7 ${col.tone}`}
            >
              <span
                className={`inline-flex size-9 items-center justify-center rounded-xl ${col.badge}`}
              >
                <col.icon className="size-4.5" strokeWidth={2.4} />
              </span>
              <h3 className="mt-5 text-lg font-bold tracking-tight">{col.heading}</h3>
              <ul className="mt-5 flex flex-col gap-3">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span
                      aria-hidden
                      className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-current opacity-40"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal
          delay={120}
          className="mt-6 rounded-2xl border border-border bg-muted/40 px-5 py-4 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:py-5"
        >
          None of this is a clearance. The medical officer at the camp screens
          you on the day and their answer is the one that counts. Which is why
          it is always worth turning up and asking.{" "}
          <Link href="/eligibility" className="font-medium text-foreground underline underline-offset-4">
            The longer list
          </Link>
          .
        </Reveal>
      </div>
    </section>
  );
}
