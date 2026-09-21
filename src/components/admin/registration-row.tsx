"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { setRegistrationStatus, type ActionState } from "@/lib/admin/actions";
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

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
        <select
          name="status"
          value={value}
          onChange={(e) => {
            const next = e.target.value as RegistrationStatus;
            setValue(next);
            if (next === "deferred") {
              setAskReason(true);
              return;
            }
            setAskReason(false);
            e.currentTarget.form?.requestSubmit();
          }}
          className={cn(
            "h-8 rounded-md border-0 px-2 text-xs font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            TONE[value],
          )}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s} className="bg-card text-foreground">
              {s}
            </option>
          ))}
        </select>
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
