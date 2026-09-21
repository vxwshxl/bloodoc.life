"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Send } from "lucide-react";
import { CampForm } from "@/components/admin/camp-form";
import { sendCampReminders, type ActionState } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import type { Camp } from "@/lib/db/types";

const STATUS_TONE: Record<Camp["status"], string> = {
  published: "bg-primary/12 text-primary",
  draft: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export function CampRow({ camp, when }: { camp: Camp; when: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(sendCampReminders, {});

  return (
    <div className="rounded-2xl border border-app-line-soft bg-card shadow-card">
      <div className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-lg font-bold tracking-tight">{camp.title}</h2>
            <span
              className={cn("rounded-md px-2 py-0.5 text-xs font-medium capitalize", STATUS_TONE[camp.status])}
            >
              {camp.status}
            </span>
            {/* Only the unusual case is badged. Every camp being marked
                "Listed" would be noise on a list where that is the default. */}
            {!camp.listed && (
              <span
                className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                title="Hidden from the home page and the camps list. The direct link still works."
              >
                Unlisted
              </span>
            )}
          </div>
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
