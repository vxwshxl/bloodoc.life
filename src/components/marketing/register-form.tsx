"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { registerDonor, type RegisterState } from "@/lib/donors/actions";
import { BLOOD_GROUPS, DONOR_KINDS, SEXES } from "@/lib/validations/donor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const FIELD = "h-10 md:h-10";

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

/** A native <select>, styled to match Input. */
function NativeSelect({
  name,
  defaultValue,
  children,
  invalid,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
  invalid?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange?.(e.target.value)}
      // A native select rather than the Radix one, for this form only. Inside a
      // scrolling dialog on a phone, the platform picker is both the faster
      // control and the one that cannot be scrolled away from its trigger.
      className={cn(
        FIELD,
        "w-full appearance-none rounded-lg border border-input bg-transparent bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat px-2.5 pr-8 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

/** Yes / No, as a pair of radios drawn as a segmented control. */
function YesNo({ name, defaultValue = "no" }: { name: string; defaultValue?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-input p-0.5">
      {["yes", "no"].map((v) => (
        <label
          key={v}
          className="relative cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground"
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
            <NativeSelect name="sex" defaultValue="" invalid={!!e.sex}>
              <option value="" disabled>Select</option>
              {SEXES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </NativeSelect>
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
            <NativeSelect name="kind" defaultValue="student" invalid={!!e.kind} onChange={setKind}>
              {DONOR_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field
            // One box on the paper form, and one column in the database. The
            // label is what changes, because "Department" means something
            // different to a student and to a member of the estate staff.
            label={
              kind === "student" ? "Department" : kind === "faculty" ? "Faculty / department" : "Department or unit"
            }
            name="department"
            error={e.department}
            className="sm:col-span-2"
          >
            <Input id="department" name="department" className={FIELD} placeholder="e.g. Physics" aria-invalid={!!e.department || undefined} />
          </Field>
          <Field
            label="Occupation"
            name="occupation"
            error={e.occupation}
            hint={kind === "student" ? "Course, if you like." : undefined}
            className="sm:col-span-2"
          >
            <Input id="occupation" name="occupation" className={FIELD} />
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
            <NativeSelect name="bloodGroup" defaultValue="unknown" invalid={!!e.bloodGroup}>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g === "unknown" ? "I don't know" : g}
                </option>
              ))}
            </NativeSelect>
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
        note="Leave anything you don't know blank — it is taken again at the desk."
      >
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Height (cm)" name="heightCm" error={e.heightCm} className="sm:col-span-3 md:col-span-1">
            <Input id="heightCm" name="heightCm" inputMode="decimal" className={FIELD} aria-invalid={!!e.heightCm || undefined} />
          </Field>
          <Field label="Weight (kg)" name="weightKg" error={e.weightKg} className="sm:col-span-3 md:col-span-1">
            <Input id="weightKg" name="weightKg" inputMode="decimal" className={FIELD} aria-invalid={!!e.weightKg || undefined} />
          </Field>
          <Field
            label="Blood pressure"
            name="bpSystolic"
            error={e.bpSystolic ?? e.bpDiastolic}
            hint="Upper / lower."
            className="sm:col-span-6 md:col-span-2"
          >
            <div className="flex items-center gap-2">
              <Input id="bpSystolic" name="bpSystolic" inputMode="numeric" className={FIELD} placeholder="120" aria-invalid={!!e.bpSystolic || undefined} />
              <span aria-hidden className="text-muted-foreground">/</span>
              <Input id="bpDiastolic" name="bpDiastolic" inputMode="numeric" className={FIELD} placeholder="80" aria-invalid={!!e.bpDiastolic || undefined} />
            </div>
          </Field>
          <Field
            label="Any medication you are taking"
            name="medications"
            error={e.medications}
            className="sm:col-span-6 md:col-span-2"
          >
            <Textarea id="medications" name="medications" rows={2} placeholder="Name them, or write None." />
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
