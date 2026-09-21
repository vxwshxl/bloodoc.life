import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { CONTACT_PHONE, WHATSAPP_HREF } from "@/lib/brand-contact";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-6 sm:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-y" />
      {/* Centred, not anchored to an edge. Pinning the bloom to the bottom puts
          its brightest point exactly on the seam with the footer, and pinning
          it to the top draws the same line against the section above. Both
          edges fade instead. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom-center" />

      <Reveal className="relative mx-auto max-w-3xl text-center">
        <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          Ready when you are
        </span>
        <h2 className="mt-6 text-5xl font-bold tracking-tight text-balance sm:text-6xl">
          Someone is waiting
          <br />
          <span className="relative inline-block text-primary">
            for your group.
            <span
              aria-hidden
              className="glow-rule absolute -bottom-1 left-0 h-[0.08em] w-full rounded-full sm:-bottom-2"
            />
          </span>
        </h2>
        <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-balance text-muted-foreground">
          Two minutes to register, forty on the day. Do it once and every camp
          after this one is just turning up.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/#camp"
            className="press inline-flex h-12 items-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Register for the next camp
          </Link>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
            className="press inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MessageCircle className="size-4" strokeWidth={2} />
            Message us on WhatsApp
          </a>
        </div>

        <p className="mt-7 text-sm text-muted-foreground">
          Or call{" "}
          <a
            href={`tel:+${CONTACT_PHONE.digits}`}
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-4"
          >
            <Phone className="size-3.5" strokeWidth={2} />
            {CONTACT_PHONE.label}
          </a>
        </p>
      </Reveal>
    </section>
  );
}
