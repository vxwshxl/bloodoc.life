"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  requestProfileChangeCode,
  updateMyProfile,
  type ProfileState,
} from "@/lib/donors/profile-actions";
import { BLOOD_GROUPS, DONOR_KINDS, SEXES } from "@/lib/validations/donor";
import type { Donor } from "@/lib/db/types";

const field =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

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
  const [codeState, requestCode, sendingCode] = useActionState<ProfileState, FormData>(
    requestProfileChangeCode,
    {},
  );
  const [saveState, save, saving] = useActionState<ProfileState, FormData>(updateMyProfile, {});
  const [kind, setKind] = useState<string>(donor?.kind ?? "student");

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
      <section>
        <h2 className="text-sm font-semibold">About you</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={e.fullName}>
            <input name="fullName" required defaultValue={donor?.full_name ?? ""} className={field} />
          </Field>
          <Field label="Sex" error={e.sex}>
            <select name="sex" defaultValue={donor?.sex ?? "male"} className={field}>
              {SEXES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth" error={e.dateOfBirth}>
            <input
              name="dateOfBirth"
              type="date"
              defaultValue={donor?.date_of_birth ?? ""}
              className={field}
            />
          </Field>
          <Field label="Age" hint="Either one is enough." error={e.age}>
            <input name="age" inputMode="numeric" defaultValue={donor?.age ?? ""} className={field} />
          </Field>
          <Field label="Father's name" error={e.fatherName}>
            <input name="fatherName" defaultValue={donor?.father_name ?? ""} className={field} />
          </Field>
          <Field label="Mother's name" error={e.motherName}>
            <input name="motherName" defaultValue={donor?.mother_name ?? ""} className={field} />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Reaching you</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {/* Shown, never editable. The address is the account: changing it
              here would either orphan this record or point it at somebody
              else's, and nothing in this flow verifies a new one. */}
          <Field label="Email" hint="This is your sign-in and cannot be changed here.">
            <div className="relative">
              <input value={email} readOnly disabled className={`${field} pr-9 opacity-70`} />
              <Lock
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.9}
              />
            </div>
          </Field>
          <Field label="Phone" error={e.phone}>
            <input name="phone" type="tel" required defaultValue={donor?.phone ?? ""} className={field} />
          </Field>
          <Field label="Alternate phone" error={e.altPhone}>
            <input name="altPhone" type="tel" defaultValue={donor?.alt_phone ?? ""} className={field} />
          </Field>
          <Field label="Address" error={e.address}>
            <input name="address" defaultValue={donor?.address ?? ""} className={field} />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">What you do</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="You are a" error={e.kind}>
            <select
              name="kind"
              value={kind}
              onChange={(ev) => setKind(ev.target.value)}
              className={field}
            >
              {DONOR_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          {kind === "other" ? (
            <Field label="Occupation" error={e.occupation}>
              <input name="occupation" defaultValue={donor?.occupation ?? ""} className={field} />
            </Field>
          ) : (
            <Field label="Department" error={e.department}>
              <input name="department" defaultValue={donor?.department ?? ""} className={field} />
            </Field>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">As a donor</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Blood group" error={e.bloodGroup}>
            <select name="bloodGroup" defaultValue={donor?.blood_group ?? "unknown"} className={field}>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g === "unknown" ? "I do not know" : g}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Donations before BlooDoc"
            hint="What you had given elsewhere before joining."
            error={e.priorDonations}
          >
            <input
              name="priorDonations"
              inputMode="numeric"
              defaultValue={donor?.prior_donations ?? 0}
              className={field}
            />
          </Field>
        </div>
      </section>

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
