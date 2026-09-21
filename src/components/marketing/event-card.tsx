"use client";

import { useState } from "react";
import { ArrowRight, Clock, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RegisterForm } from "@/components/marketing/register-form";
import { campDateParts, countdownLabel, formatCampDate, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Camp } from "@/lib/db/types";

/**
 * The hero's subject: the next camp, and the way into the form.
 *
 * The whole card is one button rather than a card containing a button. A
 * clickable panel with a nested "Register" control gives a keyboard user two
 * stops that do the same thing and a screen reader an announcement that
 * describes the wrapper and then repeats itself — so the visible call to action
 * is a `<span>`, and the button is the card.
 */
export function EventCard({
  camp,
  registered,
  className,
}: {
  camp: Camp;
  /** Places already taken, when the page knows. Drives the capacity line. */
  registered?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const d = campDateParts(camp.starts_at);
  const countdown = countdownLabel(camp.starts_at);
  const full = camp.capacity != null && registered != null && registered >= camp.capacity;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "group/card press grain relative block w-full overflow-hidden rounded-3xl border border-border bg-card text-left shadow-[var(--panel-shadow)]",
          "transition-[border-color,box-shadow] duration-300 ease-out-strong hover:border-primary/40",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
          className,
        )}
      >
        {/* The crimson head. A 3px rule would read as decoration; a full strip
            with the countdown in it is the first thing the eye lands on, which
            is the correct priority for a dated event. */}
        <span className="flex items-center justify-between gap-3 bg-primary px-5 py-2.5 text-primary-foreground sm:px-7">
          <span className="text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
            Next upcoming donation camp
          </span>
          <span className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-wide">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-primary-foreground/90 motion-safe:animate-pulse"
            />
            {countdown}
          </span>
        </span>

        <span className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:gap-7 sm:p-7">
          {/* Date block. `tabular-nums` because the day number is the largest
              thing on the card and proportional digits make 25 and 11 sit at
              visibly different widths in the same slot. */}
          <span className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-center sm:gap-0">
            <span
              className="font-display text-6xl leading-none font-black tracking-tighter text-primary sm:text-7xl"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.day}
            </span>
            <span className="flex flex-col sm:mt-1.5 sm:items-center">
              <span className="text-sm font-bold tracking-[0.16em] text-foreground">
                {d.month} {d.year}
              </span>
              <span className="text-xs text-muted-foreground">{d.weekday}</span>
            </span>
          </span>

          <span aria-hidden className="hidden w-px self-stretch bg-border sm:block" />

          <span className="min-w-0 flex-1">
            <span className="block font-display text-xl leading-tight font-bold tracking-tight text-balance sm:text-2xl">
              {camp.title}
            </span>

            <span className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
              <span className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                {formatTimeRange(camp.starts_at, camp.ends_at)}
              </span>
              <span className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                <span className="min-w-0">
                  {camp.venue}
                  {camp.city ? `, ${camp.city}` : ""}
                </span>
              </span>
              {/* Only when a camp actually declares a cap. A published number
                  that turns out to be wrong turns donors away at the door. */}
              {camp.capacity != null && (
                <span className="flex items-start gap-2.5">
                  <Users className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                  {registered != null
                    ? `${registered} of ${camp.capacity} places taken`
                    : `${camp.capacity} places`}
                </span>
              )}
            </span>

            {/* Who else is behind it, and where the units go. Both are things a
                donor weighs before deciding to turn up, so they sit on the card
                rather than a page deeper in. */}
            {(camp.collaboration || camp.partner_name) && (
              <span className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
                {camp.collaboration && (
                  <span className="block">
                    <span className="block text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      In collaboration with
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {camp.collaboration}
                    </span>
                  </span>
                )}
                {camp.partner_name && (
                  <span className="block">
                    <span className="block text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                      Blood bank partner
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {camp.partner_name}
                    </span>
                    {camp.partner_note && (
                      <span className="block text-xs text-muted-foreground">
                        {camp.partner_note}
                      </span>
                    )}
                  </span>
                )}
              </span>
            )}

            <span className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary">
              {full ? "Join the waiting list" : "Register to donate"}
              <ArrowRight
                className="size-4 transition-transform duration-300 ease-out-strong group-hover/card:translate-x-1"
                strokeWidth={2.2}
                aria-hidden
              />
            </span>
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
          <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-4 text-left backdrop-blur-xl sm:px-7">
            <DialogTitle className="font-display text-lg font-bold tracking-tight sm:text-xl">
              Register to donate
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {camp.title} · {formatCampDate(camp.starts_at)} ·{" "}
              {formatTimeRange(camp.starts_at, camp.ends_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-6 sm:px-7">
            <RegisterForm camp={camp} compact onDone={() => setOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
