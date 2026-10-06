"use client";

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { grantPartnerAccess, setUserRole, type ActionState } from "@/lib/admin/actions";
import { ViewAsButton } from "@/components/admin/view-as-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { ACCESS_OPTIONS, accessOf, type Access } from "@/lib/roles";
import { Dropdown } from "@/components/ui/dropdown";
import { StatusPill, TONE_CLASS, statusMeta } from "@/components/ui/status-pill";
import type { ConsoleUser } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";
import { DetailList } from "@/components/shell/detail-list";

export type PartnerOption = {
  id: string;
  name: string;
  short_name: string | null;
  kind: "organisation" | "blood_bank";
};

export function UserRow({
  user,
  isSelf,
  partnerOptions,
}: {
  user: ConsoleUser;
  isSelf: boolean;
  partnerOptions: PartnerOption[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setUserRole, {});
  const [open, setOpen] = useState(false);
  // Organisation and blood bank need a body picked before anything is saved.
  const [picking, setPicking] = useState<"organisation" | "blood_bank" | null>(null);
  // Optimistic rather than held in ordinary state, and the difference is what
  // happens when the change is refused. `useOptimistic` shows the new role for
  // as long as the transition runs and then snaps back to whatever the server
  // now says — which is the new role after the action revalidates, and the old
  // one if it errored. Plain state would need an effect to undo itself, and
  // leaving the control showing a role the database rejected is how somebody
  // walks away believing they promoted a volunteer who is still a donor.
  const [role, setRole] = useOptimistic<Access>(
    accessOf(user.role, user.memberships.map((m) => m.partner?.kind)),
  );
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
                if (next === "organisation" || next === "blood_bank") {
                  setPicking(next);
                  return;
                }
                const data = new FormData();
                data.set("profileId", user.id);
                data.set("role", next);
                // `startTransition`, because dispatching a useActionState
                // action from a plain event handler leaves React unable to
                // track it: `pending` never flips and the console says so. The
                // optimistic write has to be inside it for the same reason.
                startDispatch(() => {
                  setRole(next as Access);
                  action(data);
                });
              }}
              options={ACCESS_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
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

      {picking && (
        <PartnerPicker
          user={user}
          kind={picking}
          options={partnerOptions.filter((p) => p.kind === picking)}
          onClose={() => setPicking(null)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {user.full_name ?? donor?.full_name ?? user.email}
              <StatusPill status={role} />
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
              ["School", donor?.school],
              ["Department", donor?.department],
              ["Donations before BlooDoc", donor ? donor.prior_donations : null],
              ["Role", statusMeta(role).label],
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

/**
 * "Which organisation?" / "Which blood bank?" — asked when the role control is
 * set to one of the two, because the access is to a particular body.
 */
function PartnerPicker({
  user,
  kind,
  options,
  onClose,
}: {
  user: ConsoleUser;
  kind: "organisation" | "blood_bank";
  options: PartnerOption[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(grantPartnerAccess, {});
  const [partnerId, setPartnerId] = useState<string>(options[0]?.id ?? "");
  const what = kind === "blood_bank" ? "blood bank" : "organisation";

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) {
      toast.success(state.message ?? "Access given.");
      onClose();
    }
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Which {what}?</DialogTitle>
          <DialogDescription className="text-xs">
            {user.full_name ?? user.email} will see this {what}&rsquo;s camps in their panel.
            {user.role !== "donor" && " Their current role is replaced."}
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {what} is set up yet. Add one under Partners first.
          </p>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="profileId" value={user.id} />
            <input type="hidden" name="partnerId" value={partnerId} />
            <Dropdown
              value={partnerId}
              onValueChange={setPartnerId}
              options={options.map((p) => ({ value: p.id, label: p.name }))}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="press h-9 rounded-lg border border-app-line px-4 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !partnerId}
                className="press inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Give access
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
