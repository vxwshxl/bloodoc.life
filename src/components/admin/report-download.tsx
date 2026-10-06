"use client";

import { ChevronDown, FileSpreadsheet, FileText, HeartHandshake } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * A camp report download, Excel or PDF, for one list or all three.
 *
 * Organisers send the faculty list to one office and the students to another,
 * so each list is its own file; the complete report keeps all three together.
 * The items are plain links: the export route answers with the file, and the
 * browser downloads it without leaving the page.
 */
const LISTS = [
  { list: "all", label: "All donors" },
  { list: "faculty", label: "Faculty" },
  { list: "students", label: "Students" },
] as const;

const FORMATS = {
  xlsx: { label: "Excel", icon: FileSpreadsheet, tint: "text-[#1d6f42]" },
  pdf: { label: "PDF", icon: FileText, tint: "text-primary" },
} as const;

export function ReportDownload({
  campId,
  format,
  label,
  className,
}: {
  campId: string;
  format: keyof typeof FORMATS;
  /** The button's text; the format's name when left out. */
  label?: string;
  className?: string;
}) {
  const f = FORMATS[format];
  const Icon = f.icon;
  const href = (list?: string) => {
    const query = new URLSearchParams();
    if (format === "pdf") query.set("format", "pdf");
    if (list) query.set("list", list);
    const qs = query.toString();
    return `/admin/camps/${campId}/export${qs ? `?${qs}` : ""}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`Download this camp's report as ${format === "pdf" ? "a PDF" : "an Excel sheet"}`}
          className={cn(
            "press inline-flex h-9 items-center gap-1.5 rounded-full border border-app-line px-3.5 text-sm font-medium transition-colors hover:bg-muted",
            className,
          )}
        >
          <Icon className={cn("size-4", f.tint)} strokeWidth={1.9} aria-hidden />
          {label ?? f.label}
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {LISTS.map((l) => (
          <DropdownMenuItem key={l.list} asChild>
            <a href={href(l.list)} download>
              <Icon className={f.tint} strokeWidth={1.9} aria-hidden />
              {l.label}
            </a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={href()} download className="flex-col items-start gap-0.5">
            <span>Complete report</span>
            <span className="text-xs text-muted-foreground">All three lists in one file</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The camp's vote of thanks: one PDF, a page per collaborator, under the same
 * letterhead as the report. A plain link, like the report menu's items.
 */
export function ThanksDownload({ campId, className }: { campId: string; className?: string }) {
  return (
    <a
      href={`/admin/camps/${campId}/thanks`}
      download
      title="Download a vote of thanks for this camp's collaborators, one page each"
      className={cn(
        "press inline-flex h-9 items-center gap-1.5 rounded-full border border-app-line px-3.5 text-sm font-medium transition-colors hover:bg-muted",
        className,
      )}
    >
      <HeartHandshake className="size-4 text-primary" strokeWidth={1.9} aria-hidden />
      Vote of thanks
    </a>
  );
}
