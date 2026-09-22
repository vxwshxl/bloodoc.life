"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, Eye, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { deleteEmailLog, type ActionState } from "@/lib/admin/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import type { EmailLog } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * One row in the email log, with a preview and a delete.
 *
 * The body is rendered inside a sandboxed `<iframe srcDoc>`, never with
 * `dangerouslySetInnerHTML`. What is stored is HTML that was composed for an
 * email client and, for a future "resend this with an edit" feature, may not be
 * ours at all — dropping it into the console's own DOM would give it the
 * admin's session. `sandbox` with no `allow-same-origin` means it cannot reach
 * cookies, storage or the parent document, and `allow-popups` is absent so a
 * link cannot open anything either.
 */
export function EmailRow({ row }: { row: EmailLog }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteEmailLog, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Message deleted.");
  }, [state]);

  return (
    <>
      {/* The whole row opens the preview, not just the eye. A log is scanned,
          and asking someone to hit a 28px target on the row they have already
          found is a second act of aim for no reason. The delete stays its own
          button and stops the click from bubbling, so the destructive control
          is never the one you hit by accident.

          A div with a click handler rather than a <button> wrapping the row:
          the row contains its own delete button, and a button inside a button
          is invalid markup that browsers resolve by dropping one of them. The
          keyboard path is restored explicitly below. */}
      <li
        onClick={() => row.html && setOpen(true)}
        onKeyDown={(e) => {
          if (row.html && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role={row.html ? "button" : undefined}
        tabIndex={row.html ? 0 : undefined}
        aria-label={row.html ? `Preview "${row.subject}"` : undefined}
        className={cn(
          "flex items-start gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0 outline-none",
          row.html &&
            "cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
        )}
      >
        {row.ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2} aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.to_email}
            {row.template ? ` · ${row.template}` : ""} · {formatDateTime(row.created_at)}
          </p>
          {row.error && (
            <p className="mt-1 text-xs font-medium break-words text-destructive">{row.error}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Only offered when there is something to show. Rows logged before
              0010 have no body, and a preview button that opens an empty sheet
              reads as a bug rather than as missing history. */}
          {row.html && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Preview "${row.subject}"`}
              className="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-4" strokeWidth={1.9} aria-hidden />
            </button>
          )}
          <form action={action} onClick={(e) => e.stopPropagation()}>
            <input type="hidden" name="id" value={row.id} />
            <button
              type="submit"
              aria-label={`Delete "${row.subject}"`}
              className="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
              )}
            </button>
          </form>
        </div>
      </li>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base">{row.subject}</DialogTitle>
            <DialogDescription className="text-xs">
              To {row.to_email} · {formatDateTime(row.created_at)}
              {row.provider_id ? ` · ${row.provider_id}` : ""}
            </DialogDescription>
          </DialogHeader>
          <iframe
            title={`Preview of "${row.subject}"`}
            srcDoc={row.html ?? ""}
            sandbox=""
            className="h-[60vh] w-full rounded-lg border border-app-line-soft bg-white"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Clear the log" — a separate form so the row buttons stay single-purpose. */
export function ClearEmailLog({ total }: { total: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteEmailLog, {});
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Email log cleared.");
    // Deliberately not resetting `confirming` here. Setting state from an
    // effect is a second render pass for something the revalidation already
    // handles: a successful clear empties the log, and the early return below
    // unmounts this control entirely.
  }, [state]);

  if (total === 0) return null;

  // Two taps, because this one is not recoverable and the button sits beside a
  // page title rather than behind a menu.
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="press h-9 rounded-md border border-app-line px-3.5 text-sm font-medium text-muted-foreground"
      >
        Clear log
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="all" value="true" />
      <button
        type="submit"
        className="press inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-3.5 text-sm font-semibold text-white"
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
        Delete all {total}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-9 px-2 text-sm text-muted-foreground"
      >
        Cancel
      </button>
    </form>
  );
}
