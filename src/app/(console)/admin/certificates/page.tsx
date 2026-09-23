import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import {
  Pagination,
  pageFromParams,
  rangeFor,
} from "@/components/shell/pagination";
import { CertificateActions } from "@/components/partner/certificate-actions";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import type { CertificateStatus } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { DetailRow } from "@/components/shell/detail-row";
import { CertificateDetail } from "@/components/admin/certificate-detail";
import { DeleteRow } from "@/components/shell/delete-row";
import { isAdmin } from "@/lib/records/queries";

export const metadata: Metadata = { title: "Certificates" };

const FILTERS: { value: CertificateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "revoked", label: "Withdrawn" },
];

type Row = {
  id: string;
  code: string;
  status: CertificateStatus;
  issued_at: string | null;
  revoked_reason: string | null;
  registration: {
    donor: { full_name: string; blood_group: string } | null;
    camp: { title: string; starts_at: string } | null;
  } | null;
};

export default async function AdminCertificates({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const { page: pageParam, status, q } = await searchParams;
  const page = pageFromParams(pageParam);
  const filter = FILTERS.some((f) => f.value === status)
    ? (status as CertificateStatus | "all")
    : "all";

  const supabase = await createClient();
  const [from, to] = rangeFor(page);
  let query = supabase
    .from("certificates")
    .select(
      "id, code, status, issued_at, revoked_reason, registration:registrations(donor:donors(full_name, blood_group), camp:camps(title, starts_at))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filter !== "all") query = query.eq("status", filter);
  // The code is the only field on this table worth searching by — it is what
  // is printed on the paper someone is holding when they ring up. Searching by
  // donor name would need a join filter PostgREST cannot express here, and the
  // Donors page already answers that question.
  if (q?.trim()) query = query.ilike("code", `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);

  const { data, count } = await query;
  const rows = (data as unknown as Row[] | null) ?? [];
  const total = count ?? 0;
  // Never delegated: the setting on the Roles page reaches registrations only.
  const canDelete = await isAdmin();

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle={`${total} issued across every camp`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBox
          placeholder="Find a certificate code…"
          defaultValue={q}
          keep={{ status: filter === "all" ? undefined : filter }}
          clearHref="/admin/certificates"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterMenu
          label="State"
          paramName="status"
          active={filter === "all" ? undefined : filter}
          options={FILTERS.filter((f) => f.value !== "all").map((f) => ({
            value: f.value,
            label: f.label,
          }))}
        />
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing here yet"
            body="A certificate is created automatically the moment a donation is recorded on a roster."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Camp", "Code", "State", ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <DetailRow
                    key={c.id}
                    label={`Open certificate ${c.code}`}
                    title={c.registration?.donor?.full_name ?? c.code}
                    badge={<StatusPill status={c.status} />}
                    description={`Certificate ${c.code}`}
                    detail={<CertificateDetail c={c} />}
                  >
                    <td className="px-5 py-3">
                      <span className="block font-medium">
                        {c.registration?.donor?.full_name ?? "—"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {c.registration?.donor?.blood_group ?? ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block max-w-40 truncate">
                        {c.registration?.camp?.title ?? "—"}
                      </span>
                      {c.registration?.camp && (
                        <span className="block">
                          {formatCampDateShort(c.registration.camp.starts_at)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/verify/${c.code}`}
                        className="font-mono text-xs underline-offset-2 hover:underline"
                      >
                        {c.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={c.status} />
                      {c.status === "approved" && c.issued_at && (
                        <span className="mt-0.5 block text-[0.625rem] text-muted-foreground">
                          {formatDateTime(c.issued_at)}
                        </span>
                      )}
                      {c.status === "revoked" && c.revoked_reason && (
                        <span className="mt-0.5 block max-w-40 text-[0.625rem] text-muted-foreground">
                          {c.revoked_reason}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* An admin can approve anywhere; the policy in 0008 lets
                            `is_admin()` through every certificate branch. */}
                        <CertificateActions certificateId={c.id} status={c.status} canApprove />
                        {canDelete && (
                          <DeleteRow
                            table="certificates"
                            id={c.id}
                            name={c.code}
                            kind="certificate"
                            instead={
                              <>
                                A certificate issued in error should be{" "}
                                <span className="font-medium text-foreground">revoked</span>,
                                not deleted — a revoked code still resolves at /verify and
                                says so, while a deleted one just stops existing for
                                whoever is holding the printout.
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
            basePath="/admin/certificates"
            params={{ status: filter === "all" ? undefined : filter, q }}
            unit="certificate"
          />
        </Panel>
      )}
    </>
  );
}
