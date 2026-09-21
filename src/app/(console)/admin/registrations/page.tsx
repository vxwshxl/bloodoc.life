import type { Metadata } from "next";
import Link from "next/link";
import { listCamps, listRegistrations } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { StatusControl } from "@/components/admin/registration-row";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Registrations" };

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string }>;
}) {
  const { camp: campId } = await searchParams;
  const [camps, rows] = await Promise.all([listCamps(), listRegistrations(campId)]);
  const active = camps.find((c) => c.id === campId) ?? null;

  const firstTimers = rows.filter((r) => r.first_time).length;
  const donated = rows.filter((r) => r.status === "donated").length;

  return (
    <>
      <PageHeader
        title="Registrations"
        subtitle={
          active
            ? `${rows.length} on the roster · ${donated} donated · ${firstTimers} first-timers`
            : `${rows.length} across every camp`
        }
      />

      {/* Camp filter. Links rather than a select, so a roster can be bookmarked
          and reopened at the desk on the day without re-picking anything. */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/registrations"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            !campId ? "border-transparent bg-primary text-primary-foreground" : "border-app-line text-muted-foreground hover:bg-muted",
          )}
        >
          All camps
        </Link>
        {camps.map((c) => (
          <Link
            key={c.id}
            href={`/admin/registrations?camp=${c.id}`}
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

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody yet"
            body="Registrations arrive here the moment somebody submits the form on the site."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          {/* One DOM, not two. Below `sm` the table reflows to stacked blocks
              rather than a duplicate mobile list — a second block would read
              the whole roster twice to a screen reader. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Group", "History", "Vitals", "Camp", "Status"].map((h) => (
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
                      <span className="block font-medium">{r.donor.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.donor.kind === "other"
                          ? r.donor.occupation || "—"
                          : `${r.donor.kind}${r.donor.department ? ` · ${r.donor.department}` : ""}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.donor.phone} · {r.donor.email}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                        {r.donor.blood_group === "unknown" ? "?" : r.donor.blood_group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.first_time ? (
                        <span className="font-medium text-foreground">First time</span>
                      ) : (
                        `${r.donor.prior_donations} before`
                      )}
                    </td>
                    <td
                      className="px-5 py-3 text-xs text-muted-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : "—"}
                      {r.weight_kg ? ` · ${r.weight_kg}kg` : ""}
                      {/* Below 12.5 g/dL is the usual Indian cutoff, so a low
                          reading is the single most useful thing on this row at
                          the screening desk — it is the reason for most
                          deferrals, and it is called out rather than left to be
                          read off a run of grey numbers. */}
                      {r.hemoglobin_gdl != null && (
                        <span
                          className={
                            r.hemoglobin_gdl < 12.5
                              ? "font-semibold text-destructive"
                              : undefined
                          }
                        >
                          {` · Hb ${r.hemoglobin_gdl}`}
                        </span>
                      )}
                      {r.medications ? (
                        <span className="mt-0.5 block max-w-40 truncate text-foreground" title={r.medications}>
                          {r.medications}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block max-w-40 truncate">{r.camp.title}</span>
                      <span className="block">{formatDateTime(r.created_at)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusControl id={r.id} status={r.status} reason={r.deferral_reason} />
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
