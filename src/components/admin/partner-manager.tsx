"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import {
  createPartner,
  invitePartnerMember,
  removePartnerMember,
  type ActionState,
} from "@/lib/partners/actions";
import { ViewAsButton } from "@/components/admin/view-as-button";
import type { PartnerMember } from "@/lib/db/types";

const field =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * Add a collaborating body.
 *
 * The slug is derived server-side rather than asked for. Nobody running a camp
 * wants to think about URL handles, and a name typed twice by two different
 * admins should not fail on a uniqueness error they cannot interpret.
 */
export function NewPartnerForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPartner, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="size-4" strokeWidth={2.2} aria-hidden />
        Add partner
      </button>
    );
  }

  return (
    <form action={action} className="grid w-full gap-3 sm:grid-cols-2">
      <input name="name" required placeholder="Full name of the body" className={field} />
      <input name="shortName" placeholder="Short name (tables, certificates)" className={field} />
      <select name="kind" required defaultValue="organisation" className={field}>
        <option value="organisation">Organisation</option>
        <option value="blood_bank">Blood bank</option>
      </select>
      <input name="parentInstitution" placeholder="Parent institution (optional)" className={field} />
      <input name="city" placeholder="City" className={field} />
      <input name="contactEmail" type="email" placeholder="Contact email" className={field} />
      <input name="contactPhone" placeholder="Contact phone" className={field} />
      <input name="website" placeholder="Website" className={field} />

      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          className="press inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Save partner
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 px-2 text-sm text-muted-foreground"
        >
          Cancel
        </button>
        {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

/**
 * The member list for one partner, and the box that adds to it.
 *
 * Adding an address IS the invite — nothing is emailed and there is no token to
 * expire. The row waits unclaimed until somebody signs in with that address,
 * which means a typo grants nobody anything: it simply never matches.
 *
 * An unclaimed row is labelled as such, because "invited" and "has signed in"
 * look identical otherwise and the difference is exactly what an admin is
 * checking when a coordinator says the panel is not showing up.
 */
export function MemberList({
  partnerId,
  members,
}: {
  partnerId: string;
  members: PartnerMember[];
}) {
  const [inviteState, invite, inviting] = useActionState<ActionState, FormData>(
    invitePartnerMember,
    {},
  );
  const [, remove] = useActionState<ActionState, FormData>(removePartnerMember, {});
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-app-line-soft pt-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Panel access
      </p>

      {members.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nobody yet. Add an email address and that person sees this partner&rsquo;s
          panel the first time they sign in.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {m.full_name ?? m.email}
                  {m.role === "owner" && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase">
                      Owner
                    </span>
                  )}
                  {!m.profile_id && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground uppercase">
                      Not signed in yet
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.email}
                  {m.title ? ` · ${m.title}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {/* Only once they have signed in — an unclaimed invite has no
                    profile to view as yet. */}
                {m.profile_id && (
                  <ViewAsButton profileId={m.profile_id} label={m.full_name ?? m.email} />
                )}
              <form action={remove}>
                <input type="hidden" name="memberId" value={m.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${m.email}`}
                  className="press rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                </button>
              </form>
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form action={invite} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="partnerId" value={partnerId} />
          <input name="email" type="email" required placeholder="name@example.org" className={field} />
          <input name="fullName" placeholder="Name (optional)" className={field} />
          <input name="title" placeholder="Role at the body (optional)" className={field} />
          <select name="role" defaultValue="member" className={field}>
            <option value="member">Member</option>
            <option value="owner">Owner — can manage colleagues</option>
          </select>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              className="press inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
            >
              {inviting && <Loader2 className="size-3.5 animate-spin" />}
              Give access
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 px-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
            {inviteState.error && (
              <p className="text-xs font-medium text-destructive">{inviteState.error}</p>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-app-line px-3 text-xs font-medium"
        >
          <UserPlus className="size-3.5" strokeWidth={1.9} aria-hidden />
          Give someone access
        </button>
      )}
    </div>
  );
}
