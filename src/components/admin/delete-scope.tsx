"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Loader2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { setDeleteScope, type DeleteState } from "@/lib/records/actions";
import type { DeleteScope } from "@/lib/records/queries";
import { cn } from "@/lib/utils";

/**
 * Who may delete records — the one thing on the Roles page that is a control
 * rather than a description.
 *
 * It can be a control precisely because, unlike every other permission
 * described on that page, this one *is* stored somewhere configurable: a row in
 * `app_settings` that the delete policies in 0017 read on every attempt. The
 * rest of the page describes policies compiled into the database, which is why
 * they are shown and not offered.
 *
 * Two named choices rather than a switch. "Locked" and "unlocked" tell you the
 * state; they do not tell you who is affected, and this is the setting where
 * guessing wrong destroys a donor's record.
 */
const OPTIONS: {
  value: DeleteScope;
  label: string;
  hint: string;
  icon: typeof Lock;
}[] = [
  {
    value: "admin_only",
    label: "Administrators only",
    hint: "Nobody else sees a delete button anywhere in the console.",
    icon: Lock,
  },
  {
    value: "delegated",
    label: "Also the desk and blood banks",
    hint: "Verifiers, and blood bank staff at their own camps, may delete a registration. Donors, camps, certificates and accounts stay administrator-only.",
    icon: LockOpen,
  },
];

export function DeleteScopeControl({ scope }: { scope: DeleteScope }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(setDeleteScope, {});
  const [dispatching, startDispatch] = useTransition();

  const seen = useRef<DeleteState | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Saved.");
  }, [state]);

  function choose(next: DeleteScope) {
    if (next === scope) return;
    const data = new FormData();
    data.set("scope", next);
    startDispatch(() => action(data));
  }

  const busy = pending || dispatching;

  return (
    <div className="flex flex-col gap-2">
      {OPTIONS.map((o) => {
        const active = scope === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => choose(o.value)}
            disabled={busy}
            aria-pressed={active}
            className={cn(
              "press flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-60",
              active
                ? "border-primary/40 bg-primary/5"
                : "border-app-line-soft hover:border-app-line hover:bg-muted/50",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                active ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {busy && active ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Icon className="size-4" strokeWidth={1.9} aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{o.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {o.hint}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">
        This is a row in the database that the delete rules read on every
        attempt, not a setting the console remembers on its own — so a delete it
        forbids is refused by Postgres even if somebody reaches past the
        interface.
      </p>
    </div>
  );
}
