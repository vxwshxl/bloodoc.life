"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { adminUpdateDonor, type DonorEditState } from "@/lib/admin/actions";
import { DonorFields, Field, fieldClass } from "@/components/donor/donor-fields";
import type { Donor } from "@/lib/db/types";

/**
 * The registration form's answers, reopened for an administrator to correct.
 *
 * The same fields the donor sees on /me, through `DonorFields`, so a typo in a
 * father's name or a wrong school is fixed with the form's own rules rather
 * than a looser console copy of them. Saving writes the donor record; the
 * dialog this sits in goes back to showing it.
 */
export function DonorEditForm({ donor, onDone }: { donor: Donor; onDone: () => void }) {
  const [state, action, pending] = useActionState<DonorEditState, FormData>(adminUpdateDonor, {});

  const seen = useRef<DonorEditState | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      toast.success(state.message ?? "Saved.");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="donorId" value={donor.id} />

      <DonorFields
        donor={donor}
        errors={state.fieldErrors ?? {}}
        self={false}
        email={
          // The address is the donor's sign-in, so it is shown and not
          // offered: see `adminUpdateDonor`.
          <Field label="Email" hint="Their sign-in. Not editable here.">
            <div className="relative">
              <input value={donor.email} readOnly disabled className={`${fieldClass} pr-9 opacity-70`} />
              <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.9}
              />
            </div>
          </Field>
        }
      />

      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t border-app-line-soft bg-background px-1 pt-4">
        <button
          type="button"
          onClick={onDone}
          className="press h-10 rounded-lg border border-app-line px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save form
        </button>
      </div>
    </form>
  );
}
