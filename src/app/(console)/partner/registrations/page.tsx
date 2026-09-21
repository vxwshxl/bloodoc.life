import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { OutcomeControl } from "@/components/partner/outcome-control";
import { requirePartner } from "@/lib/auth/dal";
import { getPartnerCamps, getPartnerRoster } from "@/lib/partners/queries";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Roster" };

export default async function PartnerRoster({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string }>;
}) {
  const { camp: campId } = await searchParams;
  const [{ memberships }, camps, rows] = await Promise.all([
    requirePartner(),
    getPartnerCamps(),
    getPartnerRoster(campId),
  ]);

  // Recording is the blood bank's right, and it is per camp. With a camp in
  // hand the answer is that camp's `camp_partners.role`; without one the roster
  // spans camps this account may hold different capacities at, so the controls
  // are offered wherever any of them is a blood bank and the database settles
  // the rest row by row.
  const active = camps.find((c) => c.id === campId) ?? null;
  const canRecord = active
    ? active.role === "blood_bank"
    : memberships.some((m) => m.partner.kind === "blood_bank");

  const donated = rows.filter((r) => r.status === "donated").length;
  const firstTimers = rows.filter((r) => r.first_time).length;

  return (
    <>
      <PageHeader
        title="Roster"
        subtitle={
          active
            ? `${rows.length} on the roster · ${donated} donated · ${firstTimers} first-timers`
            : `${rows.length} across every camp you partner`
        }
      />

      {camps.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/partner/registrations"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              !campId
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-app-line text-muted-foreground hover:bg-muted",
            )}
          >
            All camps
          </Link>
          {camps.map((c) => (
            <Link
              key={c.id}
              href={`/partner/registrations?camp=${c.id}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                campId === c.id
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-app-line text-muted-foreground hover:bg-muted",
              )}
            >
              {c.title} · {formatCampDateShort(c.starts_at)}
            </Link>
          ))}
        </div>
      )}

      {!canRecord && rows.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Screening results and donation outcomes are recorded by the blood bank
          running the camp. Your view updates as they do.
        </p>
      )}

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody yet"
            body="Donors appear here as they register for the camps your organisation is attached to."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Group", "History", "Camp", "Certificate", "Status"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-app-line-soft last:border-b-0">
                    <td className="px-5 py-3">
                      <span className="block font-medium">{r.donor?.full_name ?? "—"}</span>
                      {r.donor && (
                        <span className="block text-xs text-muted-foreground">
                          {r.donor.phone} · {r.donor.email}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                        {!r.donor || r.donor.blood_group === "unknown" ? "?" : r.donor.blood_group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.first_time ? (
                        <span className="font-medium text-foreground">First time</span>
                      ) : (
                        `${r.donor?.prior_donations ?? 0} before`
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block max-w-40 truncate">{r.camp?.title ?? "—"}</span>
                      <span className="block">{formatDateTime(r.created_at)}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {r.certificate ? (
                        <Link
                          href={`/verify/${r.certificate.code}`}
                          className="font-mono text-xs underline-offset-2 hover:underline"
                        >
                          {r.certificate.code}
                          <span
                            className={cn(
                              "ml-2 rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase",
                              r.certificate.status === "approved"
                                ? "bg-primary/12 text-primary"
                                : r.certificate.status === "revoked"
                                  ? "bg-destructive/12 text-destructive"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {r.certificate.status}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <OutcomeControl
                        registrationId={r.id}
                        status={r.status}
                        reason={r.deferral_reason}
                        canRecord={canRecord}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
