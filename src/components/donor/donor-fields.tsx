"use client";

import { useState } from "react";
import {
  BLOOD_GROUPS,
  DONOR_KINDS,
  FATHER_TITLES,
  MOTHER_TITLES,
  HUSBAND_TITLES,
  SEXES,
  ageOn,
} from "@/lib/validations/donor";
import { OTHER_SCHOOL, SCHOOL_OPTIONS, schoolById, schoolIdForName } from "@/lib/rgu";
import { Dropdown } from "@/components/ui/dropdown";
import { DatePicker } from "@/components/ui/date-picker";
import type { Donor } from "@/lib/db/types";
import { mobileInputProps } from "@/lib/utils";

/**
 * A stored number as the box now expects it. Records saved before the rule
 * tightened may carry +91 or spaces, and opening the record should not greet
 * anyone with a number the form itself rejects.
 */
function tenDigits(stored: string | null | undefined): string {
  return (stored ?? "").replace(/\D/g, "").slice(-10);
}

const PROFILE_YEAR = new Date().getFullYear();

export const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

export function Field({
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
 * Who a donor is, how to reach them, what they do and their group: the inputs
 * behind `donorProfileSchema`, posted under the names it reads.
 *
 * Shared by the donor's own editor on /me and the console's registration
 * dialog, so the two cannot drift into asking different questions or accepting
 * different answers. `self` only changes the wording — "you" for the donor,
 * plain labels for an administrator correcting somebody else's form.
 *
 * The email is never an input here: it is the account. Each caller decides how
 * to show it, through `email`.
 */
export function DonorFields({
  donor,
  errors: e,
  email,
  self,
}: {
  donor: Donor | null;
  errors: Record<string, string>;
  email: React.ReactNode;
  self: boolean;
}) {
  const [kind, setKind] = useState<string>(donor?.kind ?? "student");
  const [age, setAge] = useState<number | null>(
    donor?.date_of_birth ? ageOn(donor.date_of_birth) : null,
  );
  // A stored school the list no longer has, or a typed department from before
  // the list existed, opens as "Other" with the text kept, not as a blank menu.
  const initialSchool =
    schoolIdForName(donor?.school) ?? (donor?.department ? OTHER_SCHOOL : "");
  const [school, setSchool] = useState<string>(initialSchool);
  const [department, setDepartment] = useState<string>(donor?.department ?? "");
  const [sameAddress, setSameAddress] = useState(
    !!donor?.address && donor.address === donor.permanent_address,
  );
  const schoolDepartments = schoolById(school)?.departments ?? [];

  return (
    <>
      <section>
        <h2 className="text-sm font-semibold">{self ? "About you" : "About the donor"}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={e.fullName}>
            <input name="fullName" required defaultValue={donor?.full_name ?? ""} className={fieldClass} />
          </Field>
          <Field label="Sex" error={e.sex}>
            <Dropdown name="sex" defaultValue={donor?.sex ?? "male"} options={SEXES} />
          </Field>
          <Field label="Date of birth" error={e.dateOfBirth}>
            <DatePicker
              name="dateOfBirth"
              defaultValue={donor?.date_of_birth ?? ""}
              fromYear={PROFILE_YEAR - 100}
              toYear={PROFILE_YEAR - 15}
              initialYear={PROFILE_YEAR - 25}
              placeholder={self ? "Pick your date of birth" : "Pick the date of birth"}
              onChange={(v) => setAge(ageOn(v))}
            />
          </Field>
          <Field label="Age" hint={self ? "Worked out from your date of birth." : "Worked out from the date of birth."}>
            <input
              readOnly
              tabIndex={-1}
              value={age === null ? "" : `${age} years`}
              placeholder="—"
              className={`${fieldClass} bg-muted/50`}
            />
          </Field>
          {/* Either parent will do; the schema asks for at least one. */}
          <Field
            label="Father's name"
            hint="Father's or mother's name. One is enough."
            error={e.fatherName ?? e.fatherTitle}
          >
            <span className="flex gap-2">
              <Dropdown
                name="fatherTitle"
                defaultValue={donor?.father_title ?? "mr"}
                options={FATHER_TITLES}
                className="w-20 shrink-0"
              />
              <input name="fatherName" defaultValue={donor?.father_name ?? ""} className={fieldClass} />
            </span>
          </Field>
          <Field label="Mother's name" error={e.motherName ?? e.motherTitle}>
            <span className="flex gap-2">
              <Dropdown
                name="motherTitle"
                defaultValue={donor?.mother_title ?? "mrs"}
                options={MOTHER_TITLES}
                className="w-20 shrink-0"
              />
              <input name="motherName" defaultValue={donor?.mother_name ?? ""} className={fieldClass} />
            </span>
          </Field>
          <Field label="Spouse's name (optional)" error={e.husbandName}>
            <span className="flex gap-2">
              <Dropdown
                name="husbandTitle"
                defaultValue={donor?.husband_title ?? "mr"}
                options={HUSBAND_TITLES}
                className="w-20 shrink-0"
              />
              <input name="husbandName" defaultValue={donor?.husband_name ?? ""} className={fieldClass} />
            </span>
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">{self ? "Reaching you" : "Contact"}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {email}
          <Field label="Phone" error={e.phone}>
            <input name="phone" {...mobileInputProps} required placeholder="10 digits" defaultValue={tenDigits(donor?.phone)} className={fieldClass} />
          </Field>
          <Field label="Alternate phone" error={e.altPhone}>
            <input name="altPhone" {...mobileInputProps} placeholder="10 digits" defaultValue={tenDigits(donor?.alt_phone)} className={fieldClass} />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <Field label="Residential address" error={e.address}>
            <textarea
              name="address"
              rows={2}
              required
              defaultValue={donor?.address ?? ""}
              className={`${fieldClass} h-auto min-h-16 py-2`}
            />
          </Field>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="sameAddress"
              checked={sameAddress}
              onChange={(ev) => setSameAddress(ev.target.checked)}
              className="tickbox shrink-0"
            />
            {self
              ? "My permanent address is the same as my residential address"
              : "Permanent address is the same as residential"}
          </label>
          {!sameAddress && (
            <Field label="Permanent address" error={e.permanentAddress}>
              <textarea
                name="permanentAddress"
                rows={2}
                required
                defaultValue={donor?.permanent_address ?? ""}
                className={`${fieldClass} h-auto min-h-16 py-2`}
              />
            </Field>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">{self ? "What you do" : "Work"}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label={self ? "You are a" : "They are a"} error={e.kind}>
            <Dropdown name="kind" value={kind} onValueChange={setKind} options={DONOR_KINDS} />
          </Field>
          {kind === "other" ? (
            <Field label="Occupation" error={e.occupation}>
              <input name="occupation" defaultValue={donor?.occupation ?? ""} className={fieldClass} />
            </Field>
          ) : (
            <Field label="School" error={e.school}>
              <Dropdown
                name="school"
                value={school}
                onValueChange={(v) => {
                  setSchool(v);
                  setDepartment("");
                }}
                options={SCHOOL_OPTIONS}
                placeholder={self ? "Pick your school" : "Pick the school"}
              />
            </Field>
          )}
          {kind !== "other" && schoolDepartments.length > 0 && (
            <Field label="Department" error={e.department}>
              <Dropdown
                name="department"
                value={schoolDepartments.includes(department) ? department : ""}
                onValueChange={setDepartment}
                options={schoolDepartments.map((d) => ({ value: d, label: d }))}
                placeholder={self ? "Pick your department" : "Pick the department"}
              />
            </Field>
          )}
          {kind !== "other" && school === OTHER_SCHOOL && (
            <Field label={kind === "student" ? "Department" : "Department / office"} error={e.department}>
              <input
                name="department"
                value={department}
                onChange={(ev) => setDepartment(ev.target.value)}
                className={fieldClass}
              />
            </Field>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">As a donor</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Blood group" error={e.bloodGroup}>
            <Dropdown
              name="bloodGroup"
              defaultValue={donor?.blood_group ?? "unknown"}
              options={BLOOD_GROUPS.map((g) => ({
                value: g,
                label: g === "unknown" ? (self ? "I do not know" : "Not known") : g,
              }))}
            />
          </Field>
          <Field
            label="Donations before BlooDoc"
            hint={self ? "What you had given elsewhere before joining." : "What they said they had given elsewhere."}
            error={e.priorDonations}
          >
            <input
              name="priorDonations"
              inputMode="numeric"
              defaultValue={donor?.prior_donations ?? 0}
              className={fieldClass}
            />
          </Field>
        </div>
      </section>
    </>
  );
}
