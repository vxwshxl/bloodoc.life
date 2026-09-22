"use client";

import { useActionState, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
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
            // The form is submitted from the value change rather than a Save
            // button. Radix hands the value back before its own close
            // animation finishes, and `requestSubmit` inside that callback
            // fires while the trigger is still mounted — which is why this is
            // read from the ref rather than an event target that is about to
            // go away.
            formRef.current?.requestSubmit();
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
