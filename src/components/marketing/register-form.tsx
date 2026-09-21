"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { registerDonor, type RegisterState } from "@/lib/donors/actions";
import { BLOOD_GROUPS, DONOR_KINDS, SEXES } from "@/lib/validations/donor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Camp } from "@/lib/db/types";
import { formatCampDate, formatTimeRange } from "@/lib/format";

/**
 * The donor registration form.
 *
 * The paper original is one unbroken column of twenty boxes. Transcribed as-is
 * that is a wall, and the fields that matter clinically — blood group, previous
 * donations, medication — sit in the middle of it with nothing marking them out
 * from a parent's name. So the same twenty questions are grouped into five
 * sections that each answer one question about the donor, in the order a person
 * can answer them: who you are, what you do, how we reach you, what you have
 * given before, and how you are today.
 *
 * Nothing was dropped and nothing was added. "Location of camp" became the camp
 * itself, because the page already knows which one you clicked.
 */

/**
 * One height for every control on this form.
 *
 * It has to be applied to the Select's `data-[size=default]:h-8` as well as to
 * `h-8` on the Input: those are different variants, so tailwind-merge does not
 * treat them as the same declaration and a bare `h-10` loses to the more
 * specific data-attribute rule. Passing both is what makes a dropdown and a
 * text box the same height — which, when they sit side by side in a grid, is
 * the difference between a form and a ransom note.
 *
 * 40px rather than the app's default 32px: this is a twenty-box form filled in
 * on a phone by somebody standing up, and 32px is below the comfortable touch
 * target on every platform guideline there is.
 */
const FIELD = "h-10 data-[size=default]:h-10";

function Field({
  label,
  name,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {/* The hint is replaced by the error rather than joined by it: two lines
          of small print under one input is where people stop reading either. */}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  step,
  title,
  note,
  children,
}: {
  step: number;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
          {step}
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * A dropdown that draws its own menu.
 *
 * Radix rather than a native `<select>`: the platform picker renders its list
 * with the OS's own background and type, which on this form sits a slab of
 * system grey in the middle of a page that is otherwise entirely our own. This
 * one opens onto `bg-popover` with our border, radius and easing, so the menu
 * belongs to the page it opened from.
 *
 * `name` still gives Radix a hidden native select underneath, so the value
 * reaches the server action through ordinary FormData and the form keeps
 * working exactly as it did.
 */
function Dropdown({
  name,
  defaultValue,
  placeholder,
  options,
  invalid,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  options: readonly { value: string; label: string }[];
  invalid?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <Select name={name} defaultValue={defaultValue} onValueChange={onChange}>
      <SelectTrigger
        id={name}
        aria-invalid={invalid || undefined}
        className={cn(FIELD, "w-full text-base md:text-sm")}
      >
        <SelectValue placeholder={placeholder ?? "Select"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Yes / No, as a pair of radios drawn as a segmented control.
 *
 * `w-fit` on the track and a fixed segment width, rather than letting it fill
 * the grid cell. Stretched to a third of the row it read as two enormous
 * buttons next to two ordinary inputs, which made the least consequential
 * question on the form look like the most important one.
 *
 * The outer height matches `FIELD` so it sits on the same baseline as the two
 * boxes beside it.
 */
function YesNo({ name, defaultValue = "no" }: { name: string; defaultValue?: string }) {
  return (
    <div className="inline-flex h-10 w-fit items-center rounded-lg border border-input p-1">
      {["yes", "no"].map((v) => (
        <label
          key={v}
          className="relative flex h-8 w-[3.25rem] cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground"
        >
          <input
            type="radio"
            name={name}
            value={v}
            defaultChecked={v === defaultValue}
            className="sr-only"
          />
          {v === "yes" ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

export function RegisterForm({
  camp,
  onDone,
  compact = false,
}: {
  camp: Camp;
  /** Called once the donor has seen the confirmation and dismissed it. */
  onDone?: () => void;
  /** Drops the camp summary — the dialog already shows it in its header. */
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerDonor,
    {},
  );
  const [kind, setKind] = useState<string>("student");
  const topRef = useRef<HTMLDivElement>(null);
  const errorId = useId();
  const e = state.fieldErrors ?? {};

  // A failed submit scrolls the summary back into view. Without this the form
  // simply does nothing visible from the donor's point of view — the message is
  // at the top of a panel they have scrolled a screen and a half past.
  useEffect(() => {
    if (state.error) topRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state.error]);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center px-2 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <CheckCircle2 className="size-7" strokeWidth={1.9} />
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold tracking-tight">
          You&rsquo;re on the roster{state.donorName ? `, ${state.donorName}` : ""}.
        </h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We have emailed you the details. Bring a photo ID on the day — it is
          the only thing you need to carry. Eat a normal meal and drink water
          before you come.
        </p>
        <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Final eligibility is decided by the medical officer after a short
          screening at the camp. Registering does not guarantee you will be able
          to donate on the day.
        </p>
        {onDone && (
          <Button onClick={onDone} className="mt-7 h-10 rounded-full px-6">
            Done
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <div ref={topRef} />
      <input type="hidden" name="campId" value={camp.id} />

      {!compact && (
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <p className="text-sm font-semibold">{camp.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCampDate(camp.starts_at)} · {formatTimeRange(camp.starts_at, camp.ends_at)} ·{" "}
            {camp.venue}
          </p>
        </div>
      )}

      {state.error && (
        <p
          id={errorId}
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      )}

      <Section step={1} title="About you" note="As it appears on the ID you will bring.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Full name" name="fullName" error={e.fullName} className="sm:col-span-4">
            <Input id="fullName" name="fullName" className={FIELD} autoComplete="name" required aria-invalid={!!e.fullName || undefined} />
          </Field>
          <Field label="Sex" name="sex" error={e.sex} className="sm:col-span-2">
            <Dropdown name="sex" options={SEXES} invalid={!!e.sex} />
          </Field>

          <Field
            label="Date of birth"
            name="dateOfBirth"
            error={e.dateOfBirth}
            className="sm:col-span-3"
          >
            <Input id="dateOfBirth" name="dateOfBirth" type="date" className={FIELD} />
          </Field>
          <Field
            label="Age"
            name="age"
            error={e.age}
            hint="Either one is enough."
            className="sm:col-span-3"
          >
            <Input id="age" name="age" inputMode="numeric" className={FIELD} placeholder="e.g. 21" aria-invalid={!!e.age || undefined} />
          </Field>

          <Field label="Father's name" name="fatherName" error={e.fatherName} className="sm:col-span-3">
            <Input id="fatherName" name="fatherName" className={FIELD} />
          </Field>
          <Field label="Mother's name" name="motherName" error={e.motherName} className="sm:col-span-3">
            <Input id="motherName" name="motherName" className={FIELD} />
          </Field>
        </div>
      </Section>

      <Section step={2} title="What you do" note="So the organisers can group the roster by department.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="You are a" name="kind" error={e.kind} className="sm:col-span-2">
            <Dropdown
              name="kind"
              defaultValue="student"
              options={DONOR_KINDS}
              invalid={!!e.kind}
              onChange={setKind}
            />
          </Field>

          {/*
            One box, not two side by side.

            The paper form has a single "Occupation — Department / Faculty"
            line, and which half of it applies depends entirely on who is
            filling it in. Showing both means a student stares at an Occupation
            box that means nothing to them and a shopkeeper stares at a
            Department box they have no answer for — and whichever they leave
            blank, the roster ends up with a column that is empty for most
            people. So the question that applies is the only one asked.

            Both inputs stay mounted rather than being swapped, so switching
            "You are a" does not throw away what was already typed in the
            other one.
          */}
          <Field
            label={kind === "student" ? "Department" : "Faculty / department"}
            name="department"
            error={e.department}
            className={cn("sm:col-span-4", kind === "other" && "hidden")}
          >
            <Input
              id="department"
              name="department"
              className={FIELD}
              placeholder={kind === "student" ? "e.g. Physics" : "e.g. Zoology"}
              aria-invalid={!!e.department || undefined}
            />
          </Field>

          <Field
            label="Occupation"
            name="occupation"
            error={e.occupation}
            hint="What you do for a living."
            className={cn("sm:col-span-4", kind !== "other" && "hidden")}
          >
            <Input
              id="occupation"
              name="occupation"
              className={FIELD}
              placeholder="e.g. Shopkeeper"
              aria-invalid={!!e.occupation || undefined}
            />
          </Field>
        </div>
      </Section>

      <Section step={3} title="Reaching you" note="Your confirmation and any change of plan goes here.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Email" name="email" error={e.email} className="sm:col-span-3">
            <Input id="email" name="email" type="email" className={FIELD} autoComplete="email" required aria-invalid={!!e.email || undefined} />
          </Field>
          <Field label="Phone" name="phone" error={e.phone} className="sm:col-span-3">
            <Input id="phone" name="phone" type="tel" inputMode="tel" className={FIELD} autoComplete="tel" required placeholder="10 digits" aria-invalid={!!e.phone || undefined} />
          </Field>
          <Field
            label="Alternate phone"
            name="altPhone"
            error={e.altPhone}
            hint="Someone who can be reached if you cannot."
            className="sm:col-span-3"
          >
            <Input id="altPhone" name="altPhone" type="tel" inputMode="tel" className={FIELD} aria-invalid={!!e.altPhone || undefined} />
          </Field>
          <Field label="Address" name="address" error={e.address} className="sm:col-span-3">
            <Input id="address" name="address" className={FIELD} autoComplete="street-address" />
          </Field>
        </div>
      </Section>

      <Section step={4} title="As a donor" note="Nothing here disqualifies you — it tells the desk what to expect.">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Blood group" name="bloodGroup" error={e.bloodGroup} className="sm:col-span-2">
            <Dropdown
              name="bloodGroup"
              defaultValue="unknown"
              options={BLOOD_GROUPS.map((g) => ({
                value: g,
                label: g === "unknown" ? "I don't know" : g,
              }))}
              invalid={!!e.bloodGroup}
            />
          </Field>
          <Field
            label="Times donated before"
            name="priorDonations"
            error={e.priorDonations}
            hint="Anywhere, not just here."
            className="sm:col-span-2"
          >
            <Input id="priorDonations" name="priorDonations" inputMode="numeric" className={FIELD} placeholder="0" aria-invalid={!!e.priorDonations || undefined} />
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">First-time donor</Label>
            <YesNo name="firstTime" defaultValue="no" />
          </div>
        </div>
      </Section>

      <Section
        step={5}
        title="How you are today"
        note="Leave anything you don't know blank — it is all taken again at the desk."
      >
        {/*
          Three rows, grouped by what each measurement is for rather than by
          what fits: body (height, weight), then the two circulatory readings
          that decide most deferrals (blood pressure, haemoglobin), then the
          one free-text answer. Medication was a cramped two-line box wedged
          beside four number fields; it is the only question here a person
          writes a sentence into, so it gets the full width and the last word.
        */}
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Height (cm)" name="heightCm" error={e.heightCm}>
              <Input
                id="heightCm"
                name="heightCm"
                inputMode="decimal"
                className={FIELD}
                placeholder="e.g. 168"
                aria-invalid={!!e.heightCm || undefined}
              />
            </Field>
            <Field label="Weight (kg)" name="weightKg" error={e.weightKg}>
              <Input
                id="weightKg"
                name="weightKg"
                inputMode="decimal"
                className={FIELD}
                placeholder="e.g. 62"
                aria-invalid={!!e.weightKg || undefined}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Blood pressure"
              name="bpSystolic"
              error={e.bpSystolic ?? e.bpDiastolic}
              hint="Upper / lower."
            >
              <div className="flex items-center gap-2">
                <Input
                  id="bpSystolic"
                  name="bpSystolic"
                  inputMode="numeric"
                  className={FIELD}
                  placeholder="120"
                  aria-invalid={!!e.bpSystolic || undefined}
                />
                <span aria-hidden className="text-muted-foreground">/</span>
                <Input
                  id="bpDiastolic"
                  name="bpDiastolic"
                  inputMode="numeric"
                  className={FIELD}
                  placeholder="80"
                  aria-invalid={!!e.bpDiastolic || undefined}
                />
              </div>
            </Field>
            <Field
              label="Haemoglobin (g/dL)"
              name="hemoglobin"
              error={e.hemoglobin}
              hint="Tested free at the camp if you don't know it."
            >
              <Input
                id="hemoglobin"
                name="hemoglobin"
                inputMode="decimal"
                className={FIELD}
                placeholder="e.g. 13.5"
                aria-invalid={!!e.hemoglobin || undefined}
              />
            </Field>
          </div>

          <Field
            label="Any medication you are taking"
            name="medications"
            error={e.medications}
            hint="Routine medication rarely stops you giving. Name it anyway — it is the answer the medical officer most needs."
          >
            <Textarea
              id="medications"
              name="medications"
              rows={3}
              className="min-h-24"
              placeholder="Name anything you take regularly, or write None."
            />
          </Field>
        </div>
      </Section>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
        <input
          type="checkbox"
          name="consent"
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          I understand that registering does not clear me to donate, that a
          medical officer will screen me at the camp, and that BlooDoc will hold
          these details to run this camp and contact me about future ones.
          {e.consent && (
            <span className="mt-1 block font-medium text-destructive">{e.consent}</span>
          )}
        </span>
      </label>

      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-full text-sm font-semibold sm:h-12 sm:text-base"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Registering…
          </>
        ) : (
          "Register to donate"
        )}
      </Button>
    </form>
  );
}
