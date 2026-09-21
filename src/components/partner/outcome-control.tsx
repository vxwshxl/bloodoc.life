"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { recordOutcome, type ActionState } from "@/lib/partners/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RegistrationStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const STATUSES: RegistrationStatus[] = [
  "registered",
  "screened",
  "donated",
  "deferred",
  "cancelled",
];

const TONE: Record<RegistrationStatus, string> = {
  donated: "bg-primary/12 text-primary",
  screened: "bg-muted text-foreground",
  registered: "bg-muted text-muted-foreground",
  deferred: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

/**
 * The desk control on a partner roster row.
 *
 * `canRecord` is false for an organisation member, and the control degrades to
 * a plain badge rather than disappearing: the status is information the
 * organisation wants — it is their donor — and a row that silently loses its
 * last column reads as a rendering bug. A disabled `<select>` would be worse
 * still, offering an affordance that never works.
 *
 * Showing it is not what enforces it. `registrations_update_bloodbank` is, and
 * a hand-rolled POST from an organisation session gets zero rows back — which
 * is the message this component surfaces if it ever happens.
 */
export function OutcomeControl({
  registrationId,
  status,
  reason,
  canRecord,
}: {
  registrationId: string;
  status: RegistrationStatus;
  reason: string | null;
  canRecord: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recordOutcome, {});
  const [value, setValue] = useState<RegistrationStatus>(status);
  const [askReason, setAskReason] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!canRecord) {
    return (
      <span
        className={cn(
          "inline-flex h-7 items-center rounded-md px-2 text-xs font-medium capitalize",
          TONE[status],
        )}
      >
        {status}
      </span>
    );
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="registrationId" value={registrationId} />
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
        <Select
          name="status"
          value={value}
          onValueChange={(next) => {
            const s = next as RegistrationStatus;
            setValue(s);
            // A deferral without a reason is the one outcome that is useless
            // later — the donor asks why they were turned away and the roster
            // cannot say. So this opens the box instead of saving.
            if (s === "deferred") {
              setAskReason(true);
              return;
            }
            setAskReason(false);
            formRef.current?.requestSubmit();
          }}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "border-0 text-xs font-medium capitalize shadow-none focus-visible:ring-2",
              TONE[value],
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

      {state.error && <p className="max-w-48 text-xs font-medium text-destructive">{state.error}</p>}
    </form>
  );
}
