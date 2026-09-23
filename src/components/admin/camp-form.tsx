"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { saveCamp, type ActionState } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Camp } from "@/lib/db/types";
import { CONFIGURABLE_FIELDS } from "@/lib/validations/donor";

/** An ISO instant → the "YYYY-MM-DDTHH:mm" a datetime-local input wants, in IST. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // `sv-SE` formats as "2026-09-25 09:00", which is the ISO-ish shape the input
  // needs with one space to swap. Doing it by hand with getHours() would read
  // the *server's* zone during SSR and the visitor's on the client.
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(" ", "T");
}

export function CampForm({ camp, onDone }: { camp?: Camp; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCamp, {});

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {camp && <input type="hidden" name="id" value={camp.id} />}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">
          Title (English)
        </Label>
        <Input id="title" name="title" defaultValue={camp?.title} className="h-10" required />
      </div>

      {/* The translated titles rotate with the English one on the camp page and
          the home card. Left blank, that title simply does not appear in the
          rotation — a camp with only an English name shows only English rather
          than cycling through two copies of the same string. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titleAs" className="text-xs font-medium text-muted-foreground">
            Title (Assamese)
          </Label>
          <Input
            id="titleAs"
            name="titleAs"
            defaultValue={camp?.title_as ?? ""}
            className="h-10"
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="titleHi" className="text-xs font-medium text-muted-foreground">
            Title (Hindi)
          </Label>
          <Input
            id="titleHi"
            name="titleHi"
            defaultValue={camp?.title_hi ?? ""}
            className="h-10"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary" className="text-xs font-medium text-muted-foreground">
          Summary
        </Label>
        <Textarea id="summary" name="summary" rows={2} defaultValue={camp?.summary ?? ""} />
        <p className="text-xs text-muted-foreground">
          Shown under the title, and used as the description in link previews and
          search results.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="collaboration" className="text-xs font-medium text-muted-foreground">
            In collaboration with
          </Label>
          <Input
            id="collaboration"
            name="collaboration"
            defaultValue={camp?.collaboration ?? ""}
            className="h-10"
            placeholder="e.g. Terapanth Yuvak Parishad, Guwahati"
          />
          <p className="text-xs text-muted-foreground">
            Shown on the site. Leave blank to show the linked partner organisations.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="partnerName" className="text-xs font-medium text-muted-foreground">
            Blood bank partner
          </Label>
          <Input
            id="partnerName"
            name="partnerName"
            defaultValue={camp?.partner_name ?? ""}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="partnerNote" className="text-xs font-medium text-muted-foreground">
            Partner&rsquo;s institution
          </Label>
          <Input
            id="partnerNote"
            name="partnerNote"
            defaultValue={camp?.partner_note ?? ""}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="venue" className="text-xs font-medium text-muted-foreground">Venue</Label>
          <Input id="venue" name="venue" defaultValue={camp?.venue} className="h-10" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city" className="text-xs font-medium text-muted-foreground">City</Label>
          <Input id="city" name="city" defaultValue={camp?.city ?? ""} className="h-10" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startsAt" className="text-xs font-medium text-muted-foreground">
            Starts (IST)
          </Label>
          {/* Posts the same zoneless "YYYY-MM-DDTHH:mm" the native input did,
              which `istToIso` reads as +05:30. */}
          <DatePicker
            id="startsAt"
            name="startsAt"
            mode="datetime"
            defaultValue={toLocalInput(camp?.starts_at ?? null)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endsAt" className="text-xs font-medium text-muted-foreground">
            Ends (IST)
          </Label>
          <DatePicker
            id="endsAt"
            name="endsAt"
            mode="datetime"
            defaultValue={toLocalInput(camp?.ends_at ?? null)}
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organiser" className="text-xs font-medium text-muted-foreground">
            Organiser
          </Label>
          <Input
            id="organiser"
            name="organiser"
            defaultValue={camp?.organiser ?? ""}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactPhone" className="text-xs font-medium text-muted-foreground">
            Contact number
          </Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            defaultValue={camp?.contact_phone ?? ""}
            className="h-10"
            placeholder="For the day itself"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacity" className="text-xs font-medium text-muted-foreground">
            Capacity
          </Label>
          <Input
            id="capacity"
            name="capacity"
            inputMode="numeric"
            defaultValue={camp?.capacity ?? ""}
            className="h-10"
            placeholder="Leave blank for no limit"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status" className="text-xs font-medium text-muted-foreground">
            Status
          </Label>
          {/* The same custom dropdown the public form uses, so the console's
              menus are not the one place in the product that opens an OS
              widget. `name` keeps the hidden native select underneath, so the
              value still arrives in FormData. */}
          <Select name="status" defaultValue={camp?.status ?? "draft"}>
            <SelectTrigger id="status" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft, not on the site</SelectItem>
              <SelectItem value="published">Published, open for registration</SelectItem>
              <SelectItem value="closed">Closed, no new registrations</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/*
        Two separate questions, deliberately not one dropdown.

        Status is whether the page may be opened at all. Listing is whether we
        advertise it. A published-but-unlisted camp is reachable by anyone with
        the link and appears nowhere on the site, which is what a staff-only
        drive or a rescheduled camp needs.
      */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-app-line bg-muted/40 p-4">
        {/* `.tickbox` in globals.css: `appearance-none` strips the platform
            control entirely and the box, the border and the tick are all
            drawn by us. Still a real `<input type="checkbox">`, because the
            wrapping `<label>` has to be able to toggle it — a Radix checkbox
            renders a `<button>`, which a label cannot target. */}
        <input type="checkbox" name="listed" defaultChecked={camp?.listed ?? true} className="tickbox mt-0.5 shrink-0" />
        <span className="text-xs leading-relaxed">
          <span className="block font-semibold">Show on the home page and the camps list</span>
          <span className="mt-0.5 block text-muted-foreground">
            Untick to hide it from both. The camp page stays reachable by its
            direct link, so anyone you have already sent it to is unaffected.
          </span>
        </span>
      </label>

      {/*
        The third question, and the only one that is exclusive.

        `featured` is not `listed`: a camp can be advertised in the list without
        being the one the home page animates around. Only one camp may hold the
        slot — the index in 0011 refuses a second — and ticking this stands the
        previous holder down rather than failing.
      */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-app-line bg-muted/40 p-4">
        <input type="checkbox" name="featured" defaultChecked={camp?.featured ?? false} className="tickbox mt-0.5 shrink-0" />
        <span className="text-xs leading-relaxed">
          <span className="block font-semibold">Lead the home page</span>
          <span className="mt-0.5 block text-muted-foreground">
            This camp gets the animated hero at the top of the site. Only one
            camp can hold it — ticking this takes it from whichever camp has it
            now. With none selected the home page opens on the headline instead
            and the animation is skipped entirely.
          </span>
        </span>
      </label>

      {/*
        Which optional questions this camp insists on. Name, contact, blood
        group and the rest of the core are always required and are not offered
        here. Ticked ones show a red asterisk on the public form and are
        enforced by `registerDonor`; the rest read "(Optional)".
      */}
      <fieldset className="rounded-xl border border-app-line bg-muted/40 p-4">
        <legend className="px-1 text-xs font-semibold">Make required on the registration form</legend>
        <p className="mb-3 text-xs text-muted-foreground">Unticked questions stay optional.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONFIGURABLE_FIELDS.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="requiredFields"
                value={f.key}
                defaultChecked={camp?.required_fields?.includes(f.key) ?? false}
                className="tickbox shrink-0"
              />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="h-10 rounded-full">
        {pending ? <><Loader2 className="animate-spin" /> Saving…</> : camp ? "Save camp" : "Create camp"}
      </Button>
    </form>
  );
}

/** The "New camp" affordance: a button that swaps itself for the form. */
export function NewCampPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        New camp
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-app-line-soft bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">New camp</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="press flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      <CampForm onDone={() => setOpen(false)} />
    </div>
  );
}
