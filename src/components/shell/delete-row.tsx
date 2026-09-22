"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRecord, type DeleteState, type DeletableTable } from "@/lib/records/actions";
import { HoldToConfirm } from "@/components/shell/hold-to-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Delete one row, from any table that allows it.
 *
 * One component rather than a `DeleteDonor`, a `DeleteRegistration` and a
 * `DeleteCertificate`: the dialog, the hold, the toast and the error handling
 * were going to be identical in all of them, and the part that genuinely
 * differs — what else goes when this goes — is a prop.
 *
 * The hold is the confirmation, and there is no second button beside it. A
 * plain "are you sure?" is dismissed by reflex; holding for a second and a half
 * cannot be done by accident, and letting go is an escape that needs no
 * explaining.
 *
 * `consequences` is not decoration. The dialog's job is to answer "what am I
 * about to lose?", which for a donor reaches two tables past the row on screen,
 * and a caller that passes nothing is saying the row stands alone.
 */
export function DeleteRow({
  table,
  id,
  /** What this row is, named: "Nikita Das", "BD-2026-9F3A7C". */
  name,
  /** The kind of thing, lowercase: "registration", "donor". */
  kind,
  /** Everything else that goes with it, one phrase per line. */
  consequences,
  /** Offered instead of deleting, when there is a non-destructive option. */
  instead,
  /** `icon` for a table cell, `button` for a page header. */
  variant = "icon",
  className,
}: {
  table: DeletableTable;
  id: string;
  name: string;
  kind: string;
  consequences?: string[];
  instead?: React.ReactNode;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [wantOpen, setWantOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteRecord, {});
  const [dispatching, startDispatch] = useTransition();

  // Derived, not closed in an effect. A successful delete ends with the dialog
  // shut, and saying so as a condition means there is no render where the row
  // is gone and its dialog is still up. A failed one stays open, holding the
  // error where the person is already looking.
  const open = wantOpen && !state.ok;

  // Each dispatch returns a new result object, so this fires once per attempt
  // even when two attempts fail the same way.
  const seen = useRef<DeleteState | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Deleted.");
  }, [state]);

  function confirm() {
    const data = new FormData();
    data.set("table", table);
    data.set("id", id);
    // Inside a transition: a `useActionState` action dispatched from a plain
    // handler is one React cannot track, so `pending` never flips and the
    // button never shows that it is working.
    startDispatch(() => action(data));
  }

  const busy = pending || dispatching;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          // The row underneath opens a profile on click. Without this, reaching
          // for delete opens the thing you were trying to remove.
          onClick={(e) => {
            e.stopPropagation();
            setWantOpen(true);
          }}
          title={`Delete this ${kind}`}
          aria-label={`Delete ${name}`}
          className={cn(
            "press flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
            className,
          )}
        >
          <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWantOpen(true);
          }}
          aria-label={`Delete ${name}`}
          className={cn(
            "press inline-flex h-9 items-center gap-1.5 rounded-full border border-app-line px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive",
            className,
          )}
        >
          <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
          Delete
        </button>
      )}

      <Dialog open={open} onOpenChange={setWantOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
                <AlertTriangle className="size-4.5" strokeWidth={2} aria-hidden />
              </span>
              Delete this {kind}?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm">
              <span className="font-medium text-foreground">{name}</span> will be removed
              from the console. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {consequences?.length ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-semibold text-destructive">This also removes:</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-muted-foreground">
                {consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {instead && (
                <p className="mt-3 border-t border-destructive/20 pt-3 text-xs">{instead}</p>
              )}
            </div>
          ) : (
            instead && (
              <p className="rounded-xl border border-app-line-soft bg-muted/40 p-4 text-xs text-muted-foreground">
                {instead}
              </p>
            )
          )}

          <HoldToConfirm pending={busy} onConfirm={confirm} />

          <p id="hold-hint" className="text-center text-xs text-muted-foreground">
            Press and hold. Let go at any point to cancel.
          </p>
          <p className="text-center text-[0.6875rem] text-muted-foreground">
            The deletion is recorded in the audit log with your name on it.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
