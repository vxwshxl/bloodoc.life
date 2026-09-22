import type { Metadata } from "next";
import { Search } from "lucide-react";
import { listDonors } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { formatCampDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Donors" };

export default async function DonorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = pageFromParams(pageParam);
  const { rows: donors, total } = await listDonors(q, page, DEFAULT_PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Donors"
        subtitle={q ? `${total} matching “${q}”` : `${total} people on file`}
      />

      {/* A GET form, not a client-side filter. The result is a URL the desk can
          keep open, reload and share — and it works before any JS has run. */}
      <form className="mb-5 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.9}
          />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name, email or phone"
            className="h-10 w-full rounded-lg border border-app-line bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <button
          type="submit"
          className="press h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Search
        </button>
      </form>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title={q ? "Nobody matches that" : "No donors yet"}
            body={
              q
                ? "Try part of a name, or the last few digits of a phone number."
                : "A donor record is created the first time somebody registers for a camp."
            }
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Group", "Who", "Contact", "Donations", "Since"].map((h) => (
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
                {donors.map((d) => (
                  <tr key={d.id} className="border-b border-app-line-soft last:border-b-0">
                    <td className="px-5 py-3">
                      <span className="block font-medium">{d.full_name}</span>
                      <span className="block text-xs text-muted-foreground capitalize">
                        {d.sex}
                        {d.age ? ` · ${d.age}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                        {d.blood_group === "unknown" ? "?" : d.blood_group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block capitalize">{d.kind}</span>
                      {d.department && <span className="block">{d.department}</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block">{d.phone}</span>
                      <span className="block max-w-48 truncate">{d.email}</span>
                    </td>
                    <td
                      className="px-5 py-3 text-xs text-muted-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {d.prior_donations}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatCampDateShort(d.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            basePath="/admin/donors"
            params={{ q }}
            unit="donor"
          />
        </Panel>
      )}
    </>
  );
}
