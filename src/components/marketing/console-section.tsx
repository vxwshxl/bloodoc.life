import { Reveal } from "@/components/marketing/reveal";
import { ConsoleTimeline } from "@/components/marketing/console-timeline";

export function ConsoleSection() {
  return (
    <section id="console" className="relative px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-3xl">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            For the organisers
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            The camp runs itself on the same record the donor filled in.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            No register at the door, no spreadsheet afterwards, no evening spent
            typing up slips. The form a donor submits from their phone is the row
            the desk screens against and the line the report is built from.
          </p>
        </Reveal>

        <ConsoleTimeline />
      </div>
    </section>
  );
}
