import type { Metadata } from "next";
import Link from "next/link";
import { listCamps, listRegistrations } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { StatusControl } from "@/components/admin/registration-row";
import { VitalsCell } from "@/components/admin/vitals-cell";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Registrations" };

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string; page?: string; q?: string }>;
}) {
  const { camp: campId, page: pageParam, q } = await searchParams;
  const page = pageFromParams(pageParam);
  const [camps, { rows, total }] = await Promise.all([
    listCamps(),
    listRegistrations(campId, page, DEFAULT_PAGE_SIZE, q),
  ]);
  const active = camps.find((c) => c.id === campId) ?? null;

  // Scoped to the page, and labelled as such below. These used to be totals
  // because the query returned everything; now that it returns 25 rows,
  // presenting them as totals would quietly understate every camp.
  const firstTimers = rows.filter((r) => r.first_time).length;
  const donated = rows.filter((r) => r.status === "donated").length;

  return (
    <>
      <PageHeader
        title="Registrations"
        subtitle={
          active
            ? `${total} on the roster · ${donated} donated, ${firstTimers} first-timers on this page`
            : `${total} across every camp`
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="Donor name, email or phone"
          defaultValue={q}
          keep={{ camp: campId }}
          clearHref="/admin/registrations"
        />
      </div>

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
                  {["Donor", "Group", "History", "Screening", "Camp", "Status"].map((h) => (
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
                          ? r.donor.occupation || "–"
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
                    <td className="px-5 py-3">
                      <VitalsCell reg={r} />
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
          <Pagination
            page={page}
            total={total}
            basePath="/admin/registrations"
            params={{ camp: campId, q }}
            unit="registration"
          />
        </Panel>
      )}
    </>
  );
}
