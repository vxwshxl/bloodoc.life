"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCamp, type ActionState } from "@/lib/admin/actions";
import { HoldToConfirm } from "@/components/shell/hold-to-confirm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Delete a camp, behind a dialog that says what goes with it.
 *
 * The dialog does not ask "are you sure?" — it answers "what am I about to
 * lose?", because the cascade reaches two tables past the row on screen. The
 * confirmation itself is the hold, not a second button.
 */
export function DeleteCamp({
  campId,
  title,
  registrationCount,
  certificateCount,
}: {
  campId: string;
  title: string;
  registrationCount: number;
  certificateCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteCamp, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Camp deleted.");
  }, [state]);

  const hasData = registrationCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete this camp"
        aria-label={`Delete ${title}`}
        className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-app-line px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
      >
        <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
        Delete
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/12 text-destructive">
                <AlertTriangle className="size-4.5" strokeWidth={2} aria-hidden />
              </span>
              Delete this camp?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm">
              <span className="font-medium text-foreground">{title}</span> will be
              removed from the site and the console.
            </DialogDescription>
          </DialogHeader>

          {hasData ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-semibold text-destructive">This also deletes:</p>
              <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                <li>
                  <span className="font-semibold text-foreground tabular-nums">
                    {registrationCount}
                  </span>{" "}
                  registration{registrationCount === 1 ? "" : "s"}, with the screening
                  readings taken on the day
                </li>
                {certificateCount > 0 && (
                  <li>
                    <span className="font-semibold text-foreground tabular-nums">
                      {certificateCount}
                    </span>{" "}
                    issued certificate{certificateCount === 1 ? "" : "s"} — their
                    codes will stop resolving at <span className="font-mono">/verify</span>
                  </li>
                )}
              </ul>
              {/* The honest alternative, offered rather than left to be
                  discovered after the fact. */}
              <p className="mt-3 border-t border-destructive/20 pt-3 text-xs">
                If the camp simply finished, set its status to{" "}
                <span className="font-medium text-foreground">closed</span> instead —
                that hides it from the site and keeps every record.
              </p>
            </div>
          ) : (
            <p className="rounded-xl border border-app-line-soft bg-muted/40 p-4 text-sm text-muted-foreground">
              Nobody has registered for this camp, so nothing else is affected.
            </p>
          )}

          <form ref={formRef} action={action}>
            <input type="hidden" name="campId" value={campId} />
            <HoldToConfirm
              pending={pending}
              onConfirm={() => formRef.current?.requestSubmit()}
              label={hasData ? "Hold to delete everything" : "Hold to delete"}
            />
          </form>

          <p id="hold-hint" className="text-center text-xs text-muted-foreground">
            Press and hold. Let go at any point to cancel.
          </p>

          <p className="text-center text-[0.6875rem] text-muted-foreground">
            The deletion is recorded in the audit log either way.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
