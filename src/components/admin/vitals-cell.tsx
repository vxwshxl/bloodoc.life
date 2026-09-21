"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { setRegistrationVitals, type ActionState } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";
import type { Registration } from "@/lib/db/types";

/**
 * The screening readings on a roster row: a summary that opens into inputs.
 *
 * Read-only until someone asks to edit it. A roster is looked at a hundred
 * times for every time it is written to — the desk is checking who is next far
 * more often than it is recording a cuff reading — and a table of live input
 * boxes is both slower to scan and one stray keystroke away from overwriting a
 * number nobody meant to touch.
 */
export function VitalsCell({ reg }: { reg: Registration }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    setRegistrationVitals,
    {},
  );
  const [open, setOpen] = useState(false);

  const bp =
    reg.bp_systolic && reg.bp_diastolic ? `${reg.bp_systolic}/${reg.bp_diastolic}` : null;
  const low = reg.hemoglobin_gdl != null && reg.hemoglobin_gdl < 12.5;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
        title="Record screening readings"
      >
        <span className="flex items-center gap-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
          {bp ?? "–"}
          {reg.weight_kg ? ` · ${reg.weight_kg}kg` : ""}
          <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
        </span>
        {reg.hemoglobin_gdl != null && (
          // Below 12.5 g/dL is the usual Indian cutoff, which makes this the
          // single most consequential number on the row. It is called out
          // rather than left to be read off a run of grey figures.
          <span
            className={cn("block", low && "font-semibold text-destructive")}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            Hb {reg.hemoglobin_gdl}
          </span>
        )}
        {reg.medications && (
          <span className="block max-w-40 truncate text-foreground" title={reg.medications}>
            {reg.medications}
          </span>
        )}
      </button>
    );
  }

  return (
    <form
      action={action}
      onSubmit={() => setOpen(false)}
      className="flex w-56 flex-col gap-1.5"
    >
      <input type="hidden" name="id" value={reg.id} />

      <div className="grid grid-cols-2 gap-1.5">
        <Num name="heightCm" label="Ht cm" defaultValue={reg.height_cm} />
        <Num name="weightKg" label="Wt kg" defaultValue={reg.weight_kg} />
        <div className="flex items-center gap-1">
          <Num name="bpSystolic" label="Sys" defaultValue={reg.bp_systolic} />
          <span aria-hidden className="text-xs text-muted-foreground">/</span>
          <Num name="bpDiastolic" label="Dia" defaultValue={reg.bp_diastolic} />
        </div>
        <Num name="hemoglobin" label="Hb" defaultValue={reg.hemoglobin_gdl} autoFocus />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Save
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-7 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>

      {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
    </form>
  );
}

function Num({
  name,
  label,
  defaultValue,
  autoFocus,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
  autoFocus?: boolean;
}) {
  return (
    <input
      name={name}
      // `defaultValue ?? ""`, not `|| ""`: a real reading of 0 would be wrong,
      // but the pattern matters — `||` turns every falsy value into a blank,
      // and blank means "not taken" everywhere in this form.
      defaultValue={defaultValue ?? ""}
      aria-label={label}
      placeholder={label}
      inputMode="decimal"
      autoFocus={autoFocus}
      className="h-7 w-full min-w-0 rounded-md border border-input bg-transparent px-1.5 text-xs outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ fontVariantNumeric: "tabular-nums" }}
    />
  );
}
