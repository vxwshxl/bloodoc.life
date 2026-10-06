"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setRegistrationStatus, type ActionState } from "@/lib/admin/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RegistrationStatus } from "@/lib/db/types";
import { TONE_CLASS, statusMeta } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

/**
 * The outcomes offered at the desk. "Deferred" is not one of them: the
 * organisers do not record deferrals, and the database value is kept only so
 * any older row still reads correctly.
 */
const STATUSES: RegistrationStatus[] = ["registered", "screened", "donated", "cancelled"];

/**
 * The status control on a roster row.
 *
 * Submitting on change rather than behind a Save button: at a camp desk this is
 * tapped a few hundred times in a morning by somebody holding a clipboard, and
 * a second tap per donor is a second tap that gets skipped.
 */
export function StatusControl({
  id,
  status,
}: {
  id: string;
  status: RegistrationStatus;
  reason?: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setRegistrationStatus,
    {},
  );
  const [value, setValue] = useState<RegistrationStatus>(status);
  const [dispatching, startDispatch] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        {(pending || dispatching) && (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
        <Select
          name="status"
          value={value}
          onValueChange={(next) => {
            const status = next as RegistrationStatus;
            setValue(status);
            // Built here and dispatched, rather than `requestSubmit()`.
            //
            // Radix writes the new value into its hidden input on its own
            // schedule, so a submit fired from inside this callback could post
            // the *previous* status — at a desk that means recording the wrong
            // outcome against a donor. The other fields are read from the form
            // as normal; only the racing one is set explicitly, from the value
            // this callback was handed.
            const form = formRef.current;
            if (!form) return;
            const data = new FormData(form);
            data.set("status", status);
            // Wrapped, because a useActionState action dispatched from a plain
            // event handler is one React cannot track — `pending` never flips,
            // so the spinner never shows and the console warns about it.
            startDispatch(() => action(data));
          }}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "border-0 text-xs font-medium capitalize shadow-none focus-visible:ring-2",
              TONE_CLASS[statusMeta(value).tone],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
    </form>
  );
}

/**
 * The outcome as a row of buttons, saved the moment one is pressed.
 *
 * The dialog's version of `StatusControl`. The table keeps its dropdown; in
 * the dialog every choice is visible at once, because somebody who has opened
 * a record is deciding, not skimming.
 *
 * `onSaved` reports the status the server accepted, so the dialog's own save
 * posts that and never writes back the one it opened with.
 */
export function StatusBar({
  id,
  status,
  onSaved,
}: {
  id: string;
  status: RegistrationStatus;
  reason?: string | null;
  onSaved?: (status: RegistrationStatus, reason: string | null) => void;
}) {
  const [saved, setSaved] = useState<RegistrationStatus>(status);
  const [value, setValue] = useState<RegistrationStatus>(status);
  const [busy, startSave] = useTransition();

  function save(next: RegistrationStatus) {
    const data = new FormData();
    data.set("id", id);
    data.set("status", next);
    startSave(async () => {
      const result = await setRegistrationStatus({}, data);
      if (result.error) {
        toast.error(result.error);
        setValue(saved);
        return;
      }
      setSaved(next);
      onSaved?.(next, null);
      toast.success(`Marked ${next}.`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Outcome"
          className="grid flex-1 grid-cols-4 gap-1 rounded-xl border border-app-line-soft bg-muted/40 p-1"
        >
          {STATUSES.map((s) => {
            const active = value === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                onClick={() => {
                  if (s === value) return;
                  setValue(s);
                  save(s);
                }}
                className={cn(
                  "press h-9 cursor-pointer rounded-lg px-1 text-xs font-semibold capitalize transition-colors disabled:cursor-wait",
                  active
                    ? TONE_CLASS[statusMeta(s).tone]
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
        {busy && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
