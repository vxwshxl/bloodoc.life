"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setUserRole, type ActionState } from "@/lib/admin/actions";
import { ViewAsButton } from "@/components/admin/view-as-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { ROLES } from "@/lib/roles";
import { Dropdown } from "@/components/ui/dropdown";
import { StatusPill, TONE_CLASS, statusMeta } from "@/components/ui/status-pill";
import type { ConsoleUser } from "@/lib/admin/queries";
import type { UserRole } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { DetailList } from "@/components/shell/detail-list";

export function UserRow({ user, isSelf }: { user: ConsoleUser; isSelf: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setUserRole, {});
  const [open, setOpen] = useState(false);
  // Optimistic rather than held in ordinary state, and the difference is what
  // happens when the change is refused. `useOptimistic` shows the new role for
  // as long as the transition runs and then snaps back to whatever the server
  // now says — which is the new role after the action revalidates, and the old
  // one if it errored. Plain state would need an effect to undo itself, and
  // leaving the control showing a role the database rejected is how somebody
  // walks away believing they promoted a volunteer who is still a donor.
  const [role, setRole] = useOptimistic<UserRole>(user.role);
  const [dispatching, startDispatch] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Role updated.");
  }, [state]);

  const donor = user.donor;
  const partners = user.memberships
    .map((m) => m.partner)
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <>
      {/* The row opens the profile; the role control and the view-as button
          stop the click on their way up so the destructive-ish controls are
          never the thing you hit while trying to read somebody's details. */}
      <tr
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${user.full_name ?? user.email}`}
        className="cursor-pointer border-b border-app-line-soft outline-none transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <td className="px-5 py-3">
          <span className="block font-medium">
            {/* A bare dash reads as missing data. These accounts genuinely have
                no name yet — a partner invite or an admin who has never
                registered — and saying so is more useful than a placeholder. */}
            {user.full_name ?? donor?.full_name ?? (
              <span className="font-normal text-muted-foreground italic">No name yet</span>
            )}
            {isSelf && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase">
                You
              </span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </td>

        <td className="px-5 py-3">
          {donor ? (
            <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
              {donor.blood_group === "unknown" ? "?" : donor.blood_group}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No record</span>
          )}
        </td>

        <td className="px-5 py-3 text-xs text-muted-foreground">
          {partners.length === 0
            ? "—"
            : partners.map((p) => p.short_name ?? p.name).join(", ")}
        </td>

        <td className="px-5 py-3 text-xs text-muted-foreground">
          {formatDateTime(user.created_at)}
        </td>

        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {(pending || dispatching) && (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            )}
            <Dropdown
              /*
               * Dispatched with data built here, not by submitting a form.
               *
               * This was `formRef.current?.requestSubmit()` inside
               * `onValueChange`, which fires before Radix has written the new
               * value into its own hidden input — so the post carried an empty
               * `role`, zod rejected it, and you got "Unknown user or role"
               * alongside the success from the submit that did land. Two
               * toasts for one change.
               *
               * Passing the value straight from the callback removes the race
               * rather than trying to win it: there is no hidden input, no
               * form, and nothing to be stale. `name` is gone from the
               * Dropdown for the same reason.
               */
              value={role}
              onValueChange={(next) => {
                // Radix re-announces its own value on mount when it is left
                // uncontrolled, which fired this callback once per row on every
                // page load — a role write per account, for nothing. Controlled
                // plus this guard means only a real change posts.
                if (next === role) return;
                const data = new FormData();
                data.set("profileId", user.id);
                data.set("role", next);
                // `startTransition`, because dispatching a useActionState
                // action from a plain event handler leaves React unable to
                // track it: `pending` never flips and the console says so. The
                // optimistic write has to be inside it for the same reason.
                startDispatch(() => {
                  setRole(next as UserRole);
                  action(data);
                });
              }}
              options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
              // Tinted by its own value, using the same tone the pill would
              // wear, so the control and the badge never disagree.
              className={cn("h-8 w-auto gap-1.5 border-0 text-xs", TONE_CLASS[statusMeta(role).tone])}
            />
          </div>
        </td>

        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {!isSelf && <ViewAsButton profileId={user.id} label={user.full_name ?? user.email} />}
        </td>
      </tr>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {user.full_name ?? donor?.full_name ?? user.email}
              <StatusPill status={user.role} />
            </DialogTitle>
            <DialogDescription className="text-xs">
              {user.email} · joined {formatDateTime(user.created_at)}
            </DialogDescription>
          </DialogHeader>

          <DetailList
            items={[
              ["Blood group", donor ? (donor.blood_group === "unknown" ? "Not known" : donor.blood_group) : null],
              ["Phone", donor?.phone],
              ["They are", donor ? <span key="k" className="capitalize">{donor.kind}</span> : null],
              ["Department", donor?.department],
              ["Donations before BlooDoc", donor ? donor.prior_donations : null],
              ["Role", <span key="r" className="capitalize">{user.role}</span>],
              [
                "Partner access",
                partners.length
                  ? partners
                      .map(
                        (p) =>
                          `${p.short_name ?? p.name} (${p.kind === "blood_bank" ? "blood bank" : "organisation"})`,
                      )
                      .join(", ")
                  : null,
                { wide: true },
              ],
            ]}
          />

          {!donor && (
            <p className="rounded-xl border border-app-line-soft bg-muted/40 p-3 text-xs text-muted-foreground">
              This account has no donor record. It was created by a partner
              invite or by being made an administrator, not by registering for a
              camp.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
