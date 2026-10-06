"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  requestProfileChangeCode,
  updateMyProfile,
  type ProfileState,
} from "@/lib/donors/profile-actions";
import { DonorFields, Field, fieldClass } from "@/components/donor/donor-fields";
import type { Donor } from "@/lib/db/types";

/**
 * The donor's own record, editable, behind a code.
 *
 * One form, two submit paths. The fields are filled in first and the code is
 * asked for last, rather than gating the whole form up front — somebody made to
 * prove their inbox before they can even see what they are changing gives up,
 * and the proof is only needed at the moment of writing.
 *
 * The values stay in the form between the two steps, so nothing half-finished
 * is parked on the server waiting to be applied.
 */
export function ProfileForm({ donor, email }: { donor: Donor | null; email: string }) {
  // `requestProfileChangeCode` takes nothing — the form's values are not sent
  // until the code comes back — so it is driven with its own tiny reducer
  // rather than being handed the FormData it would ignore.
  const [codeState, requestCode, sendingCode] = useActionState<ProfileState, FormData>(
    async () => requestProfileChangeCode(),
    {},
  );
  const [saveState, save, saving] = useActionState<ProfileState, FormData>(updateMyProfile, {});
  const awaiting = codeState.awaitingCode || saveState.awaitingCode;
  const e = saveState.fieldErrors ?? {};

  useEffect(() => {
    if (codeState.error) toast.error(codeState.error);
    else if (codeState.message) toast.success(codeState.message);
  }, [codeState]);

  useEffect(() => {
    if (saveState.error) toast.error(saveState.error);
    else if (saveState.ok) toast.success(saveState.message ?? "Saved.");
  }, [saveState]);

  return (
    <form action={save} className="flex flex-col gap-6">
      <DonorFields
        donor={donor}
        errors={e}
        self
        email={
          // Shown, never editable. The address is the account: changing it
          // here would either orphan this record or point it at somebody
          // else's, and nothing in this flow verifies a new one.
          <Field label="Email" hint="This is your sign-in and cannot be changed here.">
            <div className="relative">
              <input value={email} readOnly disabled className={`${fieldClass} pr-9 opacity-70`} />
              <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.9}
              />
            </div>
          </Field>
        }
      />

      <div className="rounded-xl border border-app-line bg-muted/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" strokeWidth={2} aria-hidden />
          Confirm it is you
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          This record is what the screening desk reads on the day, so a change
          needs the same proof of inbox that signing in takes.
        </p>

        {!awaiting ? (
          <button
            type="submit"
            formAction={requestCode}
            formNoValidate
            className="press mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {sendingCode && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Email me a code
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              name="code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              aria-label="Confirmation code"
              className="h-10 w-32 rounded-lg border border-input bg-transparent px-3 text-center text-base font-semibold tracking-[0.3em] tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              className="press inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </button>
            <button
              type="submit"
              formAction={requestCode}
              formNoValidate
              className="h-10 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Send another
            </button>
          </div>
        )}

        {(saveState.error || codeState.error) && (
          <p role="alert" className="mt-2 text-xs font-medium text-destructive">
            {saveState.error ?? codeState.error}
          </p>
        )}
      </div>
    </form>
  );
}
