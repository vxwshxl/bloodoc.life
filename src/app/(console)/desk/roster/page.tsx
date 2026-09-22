import type { Metadata } from "next";
import { listCamps, listRegistrations } from "@/lib/admin/queries";
import { requireVerifier } from "@/lib/auth/dal";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { StatusControl } from "@/components/admin/registration-row";
import { VitalsCell } from "@/components/admin/vitals-cell";
import { formatCampDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Roster" };

export default async function DeskRoster({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string; page?: string; q?: string }>;
}) {
  const { camp: campId, page: pageParam, q } = await searchParams;
  const page = pageFromParams(pageParam);

  const [, camps, { rows, total }] = await Promise.all([
    requireVerifier(),
    listCamps(),
    listRegistrations(campId, page, DEFAULT_PAGE_SIZE, q),
  ]);

  const active = camps.find((c) => c.id === campId) ?? null;
  const donated = rows.filter((r) => r.status === "donated").length;

  return (
    <>
      <PageHeader
        title={active ? active.title : "All registrations"}
        subtitle={
          active
            ? `${formatCampDateShort(active.starts_at)} · ${total} on the roster · ${donated} donated on this page`
            : `${total} across every camp`
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchBox
          placeholder="Name, email or phone"
          defaultValue={q}
          keep={{ camp: campId }}
          clearHref="/desk/roster"
        />
        <FilterMenu
          label="Camp"
          paramName="camp"
          active={campId}
          options={camps.map((c) => ({
            value: c.id,
            label: c.title,
            hint: formatCampDateShort(c.starts_at),
          }))}
        />
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody here"
            body="Registrations appear as people sign up. A walk-in can be added from the console."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Group", "History", "Screening", "Status"].map((h) => (
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
                      <span className="block text-xs text-muted-foreground">{r.donor.phone}</span>
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
            basePath="/desk/roster"
            params={{ camp: campId, q }}
            unit="registration"
          />
        </Panel>
      )}
    </>
  );
}
