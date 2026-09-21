import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { getPartnerCamps } from "@/lib/partners/queries";
import { formatCampDate, formatTimeRange } from "@/lib/format";

export const metadata: Metadata = { title: "Camps" };

export default async function PartnerCamps() {
  const camps = await getPartnerCamps();

  return (
    <>
      <PageHeader
        title="Camps"
        subtitle={`${camps.length} camp${camps.length === 1 ? "" : "s"} your organisation is attached to`}
      />

      {camps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No camps yet"
            body="An administrator attaches your organisation to a camp. It appears here as soon as they do."
          />
        </Panel>
      ) : (
        <div className="grid gap-3">
          {camps.map((c) => (
            <Panel key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold tracking-tight">{c.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCampDate(c.starts_at)} · {formatTimeRange(c.starts_at, c.ends_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.venue}
                    {c.city ? `, ${c.city}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide uppercase">
                    {c.role === "blood_bank" ? "Blood bank" : "Organiser"}
                  </span>
                  <Link
                    href={`/partner/registrations?camp=${c.id}`}
                    className="press rounded-md border border-app-line px-3 py-1.5 text-xs font-medium"
                  >
                    Open roster
                  </Link>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
