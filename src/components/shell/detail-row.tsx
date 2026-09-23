"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A table row that opens an overview of the record it describes.
 *
 * The generic form of `RegistrationRowLink`: the page, a Server Component,
 * renders the cells as children and the overview as `detail`, and only the row
 * element and the dialog cross into the client. `detail` is plain markup, so
 * the page keeps full control of what the overview says without a client
 * component per table.
 *
 * Clicks that land on a control inside the row (delete, view as, a status
 * dropdown, a link) belong to that control and do not open the overview.
 */
export function DetailRow({
  title,
  description,
  badge,
  detail,
  label,
  as = "tr",
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  detail: React.ReactNode;
  /** Accessible name for the row, e.g. "Open Nikita Das". */
  label: string;
  /** "li" for pages that are a list rather than a table. */
  as?: "tr" | "li";
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const rowProps = {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      const hit = (e.target as HTMLElement).closest(
        "button, a, input, select, textarea, label, [role=combobox], [role=dialog]",
      );
      if (hit) return;
      setOpen(true);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
    },
    role: "button",
    tabIndex: 0,
    "aria-label": label,
    className: cn(
      "cursor-pointer border-b border-app-line-soft outline-none transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60",
      className,
    ),
  };

  return (
    <>
      {as === "li" ? <li {...rowProps}>{children}</li> : <tr {...rowProps}>{children}</tr>}
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                {title}
                {badge}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-xs">{description}</DialogDescription>
              )}
            </DialogHeader>
            {detail}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
