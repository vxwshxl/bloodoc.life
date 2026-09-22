"use client";

import { useActionState, useEffect, useState } from "react";
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
import type { ConsoleUser } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export function UserRow({ user, isSelf }: { user: ConsoleUser; isSelf: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setUserRole, {});
  const [open, setOpen] = useState(false);

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
            {user.full_name ?? donor?.full_name ?? "—"}
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
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="profileId" value={user.id} />
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            <select
              name="role"
              defaultValue={user.role}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              aria-label={`Role for ${user.email}`}
              className={cn(
                "h-8 rounded-md border-0 px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                user.role === "admin"
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </form>
        </td>

        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {!isSelf && <ViewAsButton profileId={user.id} label={user.full_name ?? user.email} />}
        </td>
      </tr>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {user.full_name ?? donor?.full_name ?? user.email}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {user.email} · {user.role === "admin" ? "Administrator" : "Donor"} · joined{" "}
              {formatDateTime(user.created_at)}
            </DialogDescription>
          </DialogHeader>

          <dl className="flex flex-col gap-2 text-sm">
            {[
              ["Blood group", donor?.blood_group === "unknown" ? "Not known" : donor?.blood_group],
              ["Phone", donor?.phone],
              ["They are", donor?.kind],
              ["Department", donor?.department],
              ["Donations before BlooDoc", donor ? String(donor.prior_donations) : undefined],
              [
                "Partner access",
                partners.length
                  ? partners
                      .map(
                        (p) =>
                          `${p.short_name ?? p.name} (${p.kind === "blood_bank" ? "blood bank" : "organisation"})`,
                      )
                      .join(", ")
                  : undefined,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 border-b border-app-line-soft pb-2 last:border-b-0"
              >
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-right text-sm font-medium capitalize">{value || "—"}</dd>
              </div>
            ))}
          </dl>

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
