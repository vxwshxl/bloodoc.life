"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { saveCamp, type ActionState } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Camp } from "@/lib/db/types";

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
        <Label htmlFor="title" className="text-xs font-medium text-muted-foreground">Title</Label>
        <Input id="title" name="title" defaultValue={camp?.title} className="h-10" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="summary" className="text-xs font-medium text-muted-foreground">
          Summary
        </Label>
        <Textarea id="summary" name="summary" rows={2} defaultValue={camp?.summary ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(camp?.starts_at ?? null)}
            className="h-10"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="endsAt" className="text-xs font-medium text-muted-foreground">
            Ends (IST)
          </Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(camp?.ends_at ?? null)}
            className="h-10"
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
          <select
            id="status"
            name="status"
            defaultValue={camp?.status ?? "draft"}
            className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="draft">Draft — not on the site</option>
            <option value="published">Published — open for registration</option>
            <option value="closed">Closed — no new registrations</option>
          </select>
        </div>
      </div>

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
