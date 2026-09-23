"use client";

import { useState } from "react";
import {
  RegistrationDetail,
  type RegistrationDetailData,
} from "@/components/admin/registration-detail";
import { cn } from "@/lib/utils";

/**
 * A table row that opens the registration it describes.
 *
 * A wrapper rather than a prop on each page's `<tr>`, because the dialog is
 * client state and the three pages that show rosters are Server Components. The
 * cells stay where they are — they are passed straight through as children —
 * and only the row element and the dialog cross into the client.
 *
 * Controls inside the row (the status dropdown, the delete button, the vitals
 * cell) stop their own clicks. This is the other half of that: without a row
 * that opens anything, those `stopPropagation` calls were guarding nothing.
 */
export function RegistrationRowLink({
  registration,
  canEdit,
  children,
  className,
}: {
  registration: RegistrationDetailData;
  canEdit: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={(e) => {
          // A click that landed on a control in the row belongs to that
          // control. The status dropdown, the vitals cell and the delete
          // button all live inside this row, and opening the dialog on top of
          // them would make every one of them unusable.
          //
          // Done here, by looking at the target, rather than with
          // `stopPropagation` on each cell: these rows are rendered by Server
          // Components, and an `onClick` on a `<td>` there is a function prop
          // crossing the RSC boundary — which fails at runtime, not at build.
          const hit = (e.target as HTMLElement).closest(
            "button, a, input, select, textarea, label, [role=combobox], [role=dialog]",
          );
          if (hit) return;
          setOpen(true);
        }}
        onKeyDown={(e) => {
          // Enter and Space only on the row itself. Without the target check,
          // typing a space into the deferral box inside a cell would reopen
          // the dialog underneath it.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${registration.donor?.full_name ?? "this registration"}`}
        className={cn(
          "cursor-pointer border-b border-app-line-soft outline-none transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60",
          className,
        )}
      >
        {children}
      </tr>
      {/* Mounted only once opened. Twenty-five rows each holding a closed
          dialog with a form in it is twenty-five forms in the document. */}
      {open && (
        <RegistrationDetail
          registration={registration}
          canEdit={canEdit}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
