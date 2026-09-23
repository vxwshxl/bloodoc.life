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

const STATUSES: RegistrationStatus[] = [
  "registered",
  "screened",
  "donated",
  "deferred",
  "cancelled",
];

/**
 * The status control on a roster row.
 *
 * Submitting on change rather than behind a Save button: at a camp desk this is
 * tapped a few hundred times in a morning by somebody holding a clipboard, and
 * a second tap per donor is a second tap that gets skipped.
 *
 * Choosing "deferred" opens the reason box instead of saving, because a
 * deferral with no reason is the one status that is useless later — the next
 * camp needs to know whether it was low haemoglobin or a cold.
 */
export function StatusControl({
  id,
  status,
  reason,
}: {
  id: string;
  status: RegistrationStatus;
  reason: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setRegistrationStatus,
    {},
  );
  const [value, setValue] = useState<RegistrationStatus>(status);
  const [askReason, setAskReason] = useState(false);
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
            if (status === "deferred") {
              setAskReason(true);
              return;
            }
            setAskReason(false);
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

      {askReason && (
        <div className="flex items-center gap-2">
          <input
            name="deferralReason"
            defaultValue={reason ?? ""}
            autoFocus
            placeholder="Why deferred?"
            className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            onClick={() => setAskReason(false)}
            className="press h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      )}

      {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
    </form>
  );
}

/**
 * The outcome as a row of five buttons, saved the moment one is pressed.
 *
 * The dialog's version of `StatusControl`. The table keeps its dropdown; in
 * the dialog every choice is visible at once, because somebody who has opened
 * a record is deciding, not skimming. Same action, same rule: "deferred" asks
 * for its reason before it saves.
 *
 * `onSaved` reports the status the server accepted, so the dialog's own save
 * posts that and never writes back the one it opened with.
 */
export function StatusBar({
  id,
  status,
  reason,
  onSaved,
}: {
  id: string;
  status: RegistrationStatus;
  reason: string | null;
  onSaved?: (status: RegistrationStatus, reason: string | null) => void;
}) {
  const [saved, setSaved] = useState<RegistrationStatus>(status);
  const [value, setValue] = useState<RegistrationStatus>(status);
  const [draftReason, setDraftReason] = useState(reason ?? "");
  const [busy, startSave] = useTransition();

  function save(next: RegistrationStatus, why: string | null) {
    const data = new FormData();
    data.set("id", id);
    data.set("status", next);
    if (why) data.set("deferralReason", why);
    startSave(async () => {
      const result = await setRegistrationStatus({}, data);
      if (result.error) {
        toast.error(result.error);
        setValue(saved);
        return;
      }
      setSaved(next);
      onSaved?.(next, next === "deferred" ? why : null);
      toast.success(`Marked ${next}.`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Outcome"
          className="grid flex-1 grid-cols-5 gap-1 rounded-xl border border-app-line-soft bg-muted/40 p-1"
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
                  if (s === value && s !== "deferred") return;
                  setValue(s);
                  if (s === "deferred") return;
                  save(s, null);
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

      {value === "deferred" && (
        <div className="flex items-center gap-2">
          <input
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draftReason.trim()) {
                e.preventDefault();
                save("deferred", draftReason.trim());
              }
            }}
            autoFocus
            placeholder="Why deferred? Low haemoglobin, recent fever…"
            className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            type="button"
            disabled={busy || !draftReason.trim()}
            onClick={() => save("deferred", draftReason.trim())}
            className="press h-9 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
