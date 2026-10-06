"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { saveRegistration, type ActionState } from "@/lib/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { StatusBar } from "@/components/admin/registration-row";
import { DetailList, type DetailItem } from "@/components/shell/detail-list";
import { DonorEditForm } from "@/components/admin/donor-edit-form";
import { relationLine } from "@/lib/validations/donor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCampDate, formatDateTime, formatTimeRange } from "@/lib/format";
import type { Donor, RegistrationStatus } from "@/lib/db/types";

/**
 * What the dialog needs. Deliberately a plain shape rather than the joined row
 * type: this is rendered from three different pages whose queries select
 * slightly different columns, and a structural type is what lets all three pass
 * what they have without casting.
 */
export type RegistrationDetailData = {
  id: string;
  status: RegistrationStatus;
  first_time: boolean;
  height_cm: number | null;
  weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  hemoglobin_gdl: number | null;
  pulse_bpm: number | null;
  medications: string | null;
  deferral_reason: string | null;
  created_at: string;
  // The whole record: every roster selects `donors(*)`, and the form editor
  // needs all of it to reopen the answers as they were given.
  donor: Donor | null;
  camp: { title: string; starts_at: string; ends_at: string | null; venue: string } | null;
};

/**
 * One registration, in full, editable.
 *
 * The roster shows what fits in a row; this shows the rest — who they are, how
 * to reach them, what was measured and what the outcome was — in the one place
 * somebody goes when a person is standing in front of them and the row does not
 * say enough.
 *
 * Editable by administrators and verifiers. `canEdit` only decides whether the
 * fields are inputs or text; the action behind them is gated by
 * `requireVerifier` and, underneath that, by the RLS policies that actually
 * decide. Somebody who should not be here sees the record read-only and would
 * be refused anyway.
 *
 * `canEditForm` adds "Edit form" for administrators: the donor's own answers,
 * reopened in the registration form's fields. Gated again by `requireAdmin`
 * in `adminUpdateDonor`.
 */
export function RegistrationDetail({
  registration: r,
  canEdit,
  canEditForm = false,
  open,
  onOpenChange,
}: {
  registration: RegistrationDetailData;
  canEdit: boolean;
  canEditForm?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRegistration, {});
  // Owned by the status bar, which saves on its own. The form below posts
  // whatever it last reported, so saving readings never rewinds the outcome.
  const [status, setStatus] = useState<RegistrationStatus>(r.status);
  const [reason, setReason] = useState<string | null>(r.deferral_reason);
  const [editingForm, setEditingForm] = useState(false);

  const seen = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state === seen.current) return;
    seen.current = state;
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Saved.");
  }, [state]);

  // A successful save closes the dialog, derived rather than set in an effect
  // so there is no render where the record is saved and the form is still up.
  const isOpen = open && !state.ok;

  const donor = r.donor;
  const camp = r.camp;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        // The row underneath this is itself clickable. Without the guard, a
        // click anywhere in the dialog re-opens the row it came from.
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {donor?.full_name ?? "Registration"}
            <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
              {donor?.blood_group === "unknown" ? "?" : donor?.blood_group}
            </span>
            <StatusPill status={status} />
          </DialogTitle>
          <DialogDescription className="text-xs">
            {camp ? (
              <>
                {camp.title} · {formatCampDate(camp.starts_at)},{" "}
                {formatTimeRange(camp.starts_at, camp.ends_at)}
              </>
            ) : (
              "No camp on this registration"
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Who they are. Read-only to the desk. An administrator can reopen
            the form's answers, which are saved to the donor record rather than
            this registration — so a correction holds for every camp, and two
            camps never disagree about somebody's phone number. */}
        {editingForm && donor ? (
          <DonorEditForm donor={donor} onDone={() => setEditingForm(false)} />
        ) : (
          <>
            {canEditForm && donor && (
              <div className="-mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEditingForm(true)}
                  className="press inline-flex h-8 items-center gap-1.5 rounded-lg border border-app-line px-3 text-xs font-medium"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit form
                </button>
              </div>
            )}
            <DetailList
              items={[
                ["Phone", donor?.phone],
                ["Email", donor?.email],
                ["They are", donor ? <span key="k" className="capitalize">{donor.kind}</span> : null],
                ...(donor?.school ? ([["School", donor.school, { wide: true }]] as DetailItem[]) : []),
                [donor?.kind === "other" ? "Occupation" : "Department", donor?.department ?? donor?.occupation],
                ["Age", donor?.age],
                ["Sex", donor ? <span key="s" className="capitalize">{donor.sex}</span> : null],
                ["Father / mother / spouse", relationLine(donor)],
                ["Donations before BlooDoc", donor?.prior_donations],
                ["Venue", camp?.venue],
                ["Registered", formatDateTime(r.created_at)],
                ...(donor?.address ? ([["Residential address", donor.address, { wide: true }]] as DetailItem[]) : []),
                ...(donor?.permanent_address && donor.permanent_address !== donor.address
                  ? ([["Permanent address", donor.permanent_address, { wide: true }]] as DetailItem[])
                  : []),
              ]}
            />

            {canEdit ? (
              <form action={action} className="flex flex-col gap-4">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="status" value={status} />
                {reason && <input type="hidden" name="deferralReason" value={reason} />}

                <Field label="Outcome" hint="Saves as soon as you pick one.">
                  <StatusBar
                    id={r.id}
                    status={r.status}
                    reason={r.deferral_reason}
                    onSaved={(next, why) => {
                      setStatus(next);
                      setReason(why);
                    }}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Height (cm)">
                    <Input name="heightCm" type="number" defaultValue={r.height_cm ?? ""} className="h-10" />
                  </Field>
                  <Field label="Weight (kg)">
                    <Input name="weightKg" type="number" defaultValue={r.weight_kg ?? ""} className="h-10" />
                  </Field>
                  <Field label="BP upper">
                    <Input name="bpSystolic" type="number" defaultValue={r.bp_systolic ?? ""} className="h-10" />
                  </Field>
                  <Field label="BP lower">
                    <Input name="bpDiastolic" type="number" defaultValue={r.bp_diastolic ?? ""} className="h-10" />
                  </Field>
                  <Field label="Haemoglobin" hint="g/dL">
                    <Input
                      name="hemoglobin"
                      type="number"
                      step="0.1"
                      defaultValue={r.hemoglobin_gdl ?? ""}
                      className="h-10"
                    />
                  </Field>
                  <Field label="Pulse" hint="/min">
                    <Input name="pulse" type="number" defaultValue={r.pulse_bpm ?? ""} className="h-10" />
                  </Field>
                  <Field label="First time">
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input px-3 text-sm">
                      <input
                        type="checkbox"
                        name="firstTime"
                        defaultChecked={r.first_time}
                        className="tickbox shrink-0"
                      />
                      Yes
                    </label>
                  </Field>
                </div>

                <Field label="Medications" hint="As declared, or as found at the desk.">
                  <Input
                    name="medications"
                    defaultValue={r.medications ?? ""}
                    placeholder="None"
                    className="h-10"
                  />
                </Field>


                <div className="flex items-center justify-end gap-2 border-t border-app-line-soft pt-4">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
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
                    Save readings
                  </button>
                </div>
              </form>
            ) : (
              <DetailList
                heading="On the day"
                items={[
                  ["Outcome", <StatusPill key="o" status={r.status} />],
                  ["Height", r.height_cm ? `${r.height_cm} cm` : null],
                  ["Weight", r.weight_kg ? `${r.weight_kg} kg` : null],
                  [
                    "Blood pressure",
                    r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : null,
                  ],
                  ["Haemoglobin", r.hemoglobin_gdl != null ? `${r.hemoglobin_gdl} g/dL` : null],
                  ["Pulse", r.pulse_bpm != null ? `${r.pulse_bpm} /min` : null],
                  ["First time", r.first_time ? "Yes" : "No"],
                  ["Medications", r.medications, { wide: true }],
                  ...(r.deferral_reason
                    ? ([["Deferral reason", r.deferral_reason, { wide: true }]] as DetailItem[])
                    : []),
                ]}
              />
            )}

            <p className="text-[0.6875rem] text-muted-foreground">
              Screening readings belong to this registration, not to the donor — they
              are a snapshot of one day, and an earlier camp&apos;s numbers stay as they
              were.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="ml-1 font-normal opacity-70">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}
