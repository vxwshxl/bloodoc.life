"use client";

import { useState } from "react";
import { StatusPill } from "@/components/ui/status-pill";
import {
  RegistrationDetail,
  type RegistrationDetailData,
} from "@/components/admin/registration-detail";
import { formatDateTime } from "@/lib/format";

/**
 * One line of "Latest registrations" on the overview, which opens.
 *
 * The list was inert — eight of the most recent things to happen on the site,
 * none of which you could act on. The interesting case is exactly the one it
 * shows you: somebody was deferred an hour ago and you want to know why,
 * without first working out which camp they were at and finding them in that
 * roster.
 *
 * It opens the same dialog the roster does, so there is one place a
 * registration is read and corrected rather than a lighter version here.
 */
export function RecentRegistration({
  registration: r,
  canEdit,
}: {
  registration: RegistrationDetailData;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-app-line-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/60"
      >
        <span className="inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
          {r.donor?.blood_group === "unknown" ? "?" : r.donor?.blood_group}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{r.donor?.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {r.camp?.title} · {formatDateTime(r.created_at)}
          </span>
        </span>
        <StatusPill status={r.status} className="shrink-0" />
      </button>
      {open && (
        <RegistrationDetail
          registration={r}
          canEdit={canEdit}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </li>
  );
}
