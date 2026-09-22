"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Send } from "lucide-react";
import { CampForm } from "@/components/admin/camp-form";
import { DeleteCamp } from "@/components/admin/delete-camp";
import { sendCampReminders, type ActionState } from "@/lib/admin/actions";
import { campDateParts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Camp } from "@/lib/db/types";

/**
 * A camp in the console, in the same card language the landing page uses.
 *
 * It was a full-width row. The card reads faster for the people who actually
 * use this page — an organiser scanning "which drive is this, when, is it
 * live" — because the date is a numeral they can find by shape rather than a
 * sentence they have to parse. The admin controls stay exactly where they
 * were; only the frame around them changed.
 */
export function CampRow({
  camp,
  when,
  registrationCount = 0,
  certificateCount = 0,
}: {
  camp: Camp;
  when: string;
  /** What a delete would take with it — quoted in the confirm dialog. */
  registrationCount?: number;
  certificateCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const d = campDateParts(camp.starts_at);
  const [state, action, pending] = useActionState<ActionState, FormData>(sendCampReminders, {});

  return (
    <div className="grain overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card">
      {/* The status strip. On the public card this band carries the countdown;
          here it carries the one thing an organiser checks first, which is
          whether the camp is actually live on the site. */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-5 py-2",
          camp.status === "published"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        <span className="text-[0.6875rem] font-semibold tracking-[0.18em] uppercase">
          {camp.status}
        </span>
        {!camp.listed && (
          <span
            className="text-[0.6875rem] font-semibold tracking-wide uppercase opacity-90"
            title="Hidden from the home page and the camps list. The direct link still works."
          >
            Unlisted
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4 p-5">
        {/* Tabular numerals: the day is the largest glyph on the card and
            proportional digits make 25 and 11 sit at different widths. */}
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-center sm:gap-0">
          <span
            className="font-display text-4xl leading-none font-black tracking-tighter text-primary sm:text-5xl"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {d.day}
          </span>
          <span className="flex flex-col sm:mt-1 sm:items-center">
            <span className="text-xs font-bold tracking-[0.14em] text-foreground">
              {d.month} {d.year}
            </span>
            <span className="text-[0.6875rem] text-muted-foreground">{d.weekday}</span>
          </span>
        </div>

        <div aria-hidden className="hidden w-px self-stretch bg-app-line-soft sm:block" />

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight font-bold tracking-tight text-balance">
            {camp.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {when} · {[camp.venue, camp.city].filter(Boolean).join(", ")}
            {camp.capacity ? ` · ${camp.capacity} places` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/registrations?camp=${camp.id}`}
            className="press inline-flex h-9 items-center rounded-full border border-app-line px-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Roster
          </Link>
          <form action={action}>
            <input type="hidden" name="campId" value={camp.id} />
            <button
              type="submit"
              disabled={pending}
              title="Email everyone on this roster a reminder"
              className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-app-line px-3.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" strokeWidth={1.9} />}
              Remind
            </button>
          </form>
          <DeleteCamp
            campId={camp.id}
            title={camp.title}
            registrationCount={registrationCount}
            certificateCount={certificateCount}
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="press inline-flex h-9 items-center gap-1 rounded-full border border-app-line px-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Edit
            <ChevronDown
              className={cn("size-4 transition-transform duration-200 ease-out-strong", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {(state.error || state.message) && (
        <p
          role="status"
          className={cn(
            "border-t border-app-line-soft px-5 py-3 text-sm font-medium",
            state.error ? "text-destructive" : "text-primary",
          )}
        >
          {state.error ?? state.message}
        </p>
      )}

      {open && (
        <div className="border-t border-app-line-soft p-5">
          <CampForm camp={camp} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
