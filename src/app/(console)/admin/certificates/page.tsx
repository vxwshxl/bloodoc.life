import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CampCard } from "@/components/camps/camp-card";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import { Pagination, pageFromParams, rangeFor } from "@/components/shell/pagination";
import { CertificateActions } from "@/components/partner/certificate-actions";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import type { CertificateStatus } from "@/lib/db/types";
import { StatusPill } from "@/components/ui/status-pill";
import { DetailRow } from "@/components/shell/detail-row";
import { CertificateOverview } from "@/components/admin/certificate-overview";
import { BulkCertificateDownload } from "@/components/admin/certificate-tools";
import { DeleteRow } from "@/components/shell/delete-row";
import { isAdmin } from "@/lib/records/queries";
import { listCamps } from "@/lib/admin/queries";
import {
  listApprovedCertificates,
  listCertificateCamps,
  listCertificates,
} from "@/lib/certificates/queries";

export const metadata: Metadata = { title: "Certificates" };

const FILTERS: { value: CertificateStatus; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Awaiting approval" },
  { value: "revoked", label: "Withdrawn" },
];

export default async function AdminCertificates({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string; page?: string; status?: string; q?: string; all?: string }>;
}) {
  const { camp: campId, page: pageParam, status, q, all } = await searchParams;
  const page = pageFromParams(pageParam);
  const filter = FILTERS.find((f) => f.value === status)?.value;

  /**
   * Camps first, as on Registrations. Certificates are handed out a camp at a
   * time — printed for a ceremony, zipped for the organisers — so the camp is
   * where the work starts. Searching still spans every camp, and `?all=1`
   * keeps the flat list.
   */
  const showIndex = !campId && !q?.trim() && all !== "1" && !filter;

  if (showIndex) {
    const camps = await listCertificateCamps();
    const totalAll = camps.reduce((n, c) => n + c.total, 0);
    return (
      <>
        <PageHeader
          title="Certificates"
          subtitle={`${totalAll} issued across ${camps.length} camp${camps.length === 1 ? "" : "s"}`}
        />

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SearchBox
            placeholder="Donor name or certificate code — across every camp"
            clearHref="/admin/certificates"
          />
          <Link
            href="/admin/certificates?all=1"
            className="press inline-flex h-9 shrink-0 items-center rounded-lg border border-app-line px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            One long list
          </Link>
        </div>

        {camps.length === 0 ? (
          <Panel>
            <EmptyState
              title="No camps yet"
              body="Certificates belong to a camp. They appear here as donations are recorded."
            />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {camps.map((c) => (
              <CampCard
                key={c.id}
                camp={c}
                href={`/admin/certificates?camp=${c.id}`}
                action="Open certificates"
              >
                <span className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums">{c.total}</span>
                  <span className="text-xs text-muted-foreground">
                    certificate{c.total === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {(["approved", "pending", "revoked"] as const)
                    .filter((k) => c.byStatus[k] > 0)
                    .map((k) => (
                      <StatusPill key={k} status={k} count={c.byStatus[k]} />
                    ))}
                  {c.total === 0 && (
                    <span className="text-xs text-muted-foreground">No donations recorded yet.</span>
                  )}
                </span>
              </CampCard>
            ))}
          </div>
        )}
      </>
    );
  }

  const [from, to] = rangeFor(page);
  const [camps, { rows, total }, approved, canDelete] = await Promise.all([
    listCamps(),
    listCertificates({ campId, status: filter, q, from, to }),
    campId ? listApprovedCertificates(campId) : Promise.resolve([]),
    // Never delegated: the setting on the Roles page reaches registrations only.
    isAdmin(),
  ]);
  const active = camps.find((c) => c.id === campId) ?? null;

  return (
    <>
      <Link
        href="/admin/certificates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All camps
      </Link>

      <PageHeader
        title={active ? active.title : "Certificates"}
        subtitle={
          active
            ? `${formatCampDateShort(active.starts_at)} · ${total} certificate${total === 1 ? "" : "s"}${filter ? ` ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}` : ""} · ${approved.length} approved`
            : `${total} across every camp`
        }
        // One camp at a time: a zip of every certificate ever issued is a
        // download nobody wants and a browser tab that runs out of memory.
        action={active ? <BulkCertificateDownload certs={approved} campTitle={active.title} /> : null}
      />

      <div className="mb-4">
        <SearchBox
          placeholder="Donor name or certificate code"
          defaultValue={q}
          keep={{ camp: campId, status: filter }}
          clearHref={campId ? `/admin/certificates?camp=${campId}` : "/admin/certificates"}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
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
        <FilterMenu
          label="State"
          paramName="status"
          active={filter}
          options={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing here yet"
            body="A certificate is issued and emailed automatically the moment a donation is recorded on a roster."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["#", "Donor", "Camp", "Code", "State", ""].map((h, i) => (
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
                {rows.map((c, i) => (
                  <DetailRow
                    key={c.id}
                    label={`Open certificate ${c.code}`}
                    title={c.donor.full_name}
                    badge={<StatusPill status={c.status} />}
                    description={`Certificate ${c.code}`}
                    detail={<CertificateOverview c={c} />}
                  >
                    <td
                      className="w-12 py-3 pr-0 pl-5 text-xs text-muted-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {from + i + 1}
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{c.donor.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {c.donor.blood_group === "unknown" ? "Group not known" : c.donor.blood_group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block max-w-40 truncate">{c.camp.title}</span>
                      <span className="block">{formatCampDateShort(c.camp.starts_at)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/verify/${c.code}`}
                        target="_blank"
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
                                <span className="font-medium text-foreground">withdrawn</span>,
                                not deleted — a withdrawn code still resolves at /verify and
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
            params={{ camp: campId, status: filter, q, all }}
            unit="certificate"
          />
        </Panel>
      )}
    </>
  );
}
