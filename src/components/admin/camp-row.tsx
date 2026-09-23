"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Send } from "lucide-react";
import { CampForm } from "@/components/admin/camp-form";
import { DeleteCamp } from "@/components/admin/delete-camp";
import { sendCampReminders, type ActionState } from "@/lib/admin/actions";
import { CampSummary, CampTag } from "@/components/camps/camp-card";
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
  registrationCount = 0,
  certificateCount = 0,
}: {
  camp: Camp;
  /** What a delete would take with it — quoted in the confirm dialog. */
  registrationCount?: number;
  certificateCount?: number;
}) {
  const [open, setOpen] = useState(false);
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

      <div className="flex p-5">
        <CampSummary
          camp={camp}
          badge={camp.capacity ? <CampTag>{camp.capacity} places</CampTag> : undefined}
        />
      </div>

      {/*
        The controls are their own row, under a rule, rather than a fourth item
        in the flex line above.

        They were inline with the title, which worked while each card was the
        full width of the page. In the two-column grid there is no longer room
        for both, and because the details column carries `flex-1` it is the one
        that gives — so the buttons kept their width and the camp title was
        squeezed to one word per line. Wrapping is the fix, and a row that is
        always separate wraps predictably at every width instead of only past a
        breakpoint.
      */}
      <div className="flex flex-wrap items-center gap-2 border-t border-app-line-soft px-5 py-3">
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
