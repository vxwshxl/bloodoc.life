import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { getEffectiveRecord } from "@/lib/auth/impersonation";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import type { RegistrationRow } from "@/lib/admin/queries";
import { StatusPill } from "@/components/ui/status-pill";

export const metadata: Metadata = { title: "Applications" };

/** What each outcome actually means, in the donor's own terms. */
const MEANS: Record<string, string> = {
  registered: "You are on the roster. Bring a photo ID on the day.",
  screened: "You were screened at the desk.",
  donated: "You gave blood. Thank you.",
  deferred: "You were not able to give on the day.",
  cancelled: "This registration was cancelled.",
};

export default async function ApplicationsPage() {
  const record = await getEffectiveRecord();
  const rows = record.registrations as RegistrationRow[];

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={`${rows.length} camp${rows.length === 1 ? "" : "s"} on your record`}
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing yet"
            body="Register for a camp and it appears here with what happened on the day."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Panel key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold tracking-tight">
                    {r.camp.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCampDate(r.camp.starts_at)} ·{" "}
                    {formatTimeRange(r.camp.starts_at, r.camp.ends_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {r.camp.venue}
                    {r.camp.city ? `, ${r.camp.city}` : ""}
                  </p>
                </div>
                <StatusPill status={r.status} className="shrink-0" />
              </div>

              <p className="mt-3 border-t border-app-line-soft pt-3 text-sm text-muted-foreground">
                {MEANS[r.status]}
              </p>

              {/* The reason matters more than the status here: a donor turned
                  away wants to know whether it is something they can fix. */}
              {r.status === "deferred" && r.deferral_reason && (
                <p className="mt-1 text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {r.deferral_reason}
                </p>
              )}

              {r.status === "donated" && (
                <Link
                  href="/dashboard/certificates"
                  className="mt-3 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  See your certificate →
                </Link>
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
