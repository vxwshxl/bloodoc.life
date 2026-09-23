import type { Metadata } from "next";
import { listDonors } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { ViewAsButton } from "@/components/admin/view-as-button";
import { DeleteRow } from "@/components/shell/delete-row";
import { isAdmin } from "@/lib/records/queries";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { formatCampDate, formatCampDateShort } from "@/lib/format";
import { DetailRow } from "@/components/shell/detail-row";
import { DetailList } from "@/components/shell/detail-list";

export const metadata: Metadata = { title: "Donors" };

export default async function DonorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = pageFromParams(pageParam);
  // Deleting a donor is never delegated — the setting on the Roles page only
  // reaches registrations. This is a person's whole record.
  const [{ rows: donors, total }, canDelete] = await Promise.all([
    listDonors(q, page, DEFAULT_PAGE_SIZE),
    isAdmin(),
  ]);

  return (
    <>
      <PageHeader
        title="Donors"
        subtitle={q ? `${total} matching “${q}”` : `${total} people on file`}
      />

      <div className="mb-5">
        <SearchBox
          placeholder="Name, email or phone"
          defaultValue={q}
          clearHref="/admin/donors"
        />
      </div>

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
                  {["Donor", "Group", "Who", "Contact", "Donations", "Since", ""].map((h, i) => (
                    <th
                      key={h || i}
                      className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <DetailRow
                    key={d.id}
                    label={`Open ${d.full_name}`}
                    title={d.full_name}
                    badge={
                      <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                        {d.blood_group === "unknown" ? "?" : d.blood_group}
                      </span>
                    }
                    description={`${d.email} · on file since ${formatCampDate(d.created_at)}`}
                    detail={
                      <div className="flex flex-col gap-5">
                        <DetailList
                          heading="About"
                          items={[
                            ["Sex", <span key="s" className="capitalize">{d.sex}</span>],
                            ["Age", d.age],
                            ["Date of birth", d.date_of_birth ? formatCampDate(d.date_of_birth) : null],
                            ["Father's name", d.father_name],
                            ["Mother's name", d.mother_name],
                          ]}
                        />
                        <DetailList
                          heading="Work"
                          items={[
                            ["They are", <span key="k" className="capitalize">{d.kind}</span>],
                            [d.kind === "other" ? "Occupation" : "Department", d.kind === "other" ? d.occupation : d.department],
                          ]}
                        />
                        <DetailList
                          heading="Contact"
                          items={[
                            ["Phone", d.phone],
                            ["Alternate phone", d.alt_phone],
                            ["Email", d.email],
                            ["Address", d.address],
                          ]}
                        />
                        <DetailList
                          heading="As a donor"
                          items={[
                            ["Blood group", d.blood_group === "unknown" ? "Not known" : d.blood_group],
                            ["Donations before BlooDoc", d.prior_donations],
                            ["Account", d.profile_id ? "Signed in at least once" : "No account (paper slip)"],
                            ["Notes", d.notes],
                          ]}
                        />
                      </div>
                    }
                  >
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
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Only for a donor who actually has an account. One
                            entered from a paper slip has no profile to view as,
                            and a disabled button on most rows would be noise. */}
                        {d.profile_id && (
                          <ViewAsButton profileId={d.profile_id} label={d.full_name} />
                        )}
                        {canDelete && (
                          <DeleteRow
                            table="donors"
                            id={d.id}
                            name={d.full_name}
                            kind="donor"
                            consequences={[
                              "every camp registration in their name, and the screening readings with them",
                              "any certificate they have been issued, and its code at /verify",
                            ]}
                            instead={
                              <>
                                Their account, if they have one, is not removed by this
                                — it stays on the Users page with no donor record
                                attached.
                              </>
                            }
                          />
                        )}
                      </div>
                    </td>
                  </DetailRow>
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
