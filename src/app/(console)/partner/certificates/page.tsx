import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { CertificateActions } from "@/components/partner/certificate-actions";
import { requirePartner } from "@/lib/auth/dal";
import { getPartnerCertificates } from "@/lib/partners/queries";
import { formatCampDateShort, formatDateTime } from "@/lib/format";
import type { CertificateStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificates" };

const FILTERS: { value: CertificateStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Awaiting approval" },
  { value: "approved", label: "Approved" },
  { value: "revoked", label: "Withdrawn" },
];

const TONE: Record<CertificateStatus, string> = {
  approved: "bg-primary/12 text-primary",
  pending: "bg-muted text-muted-foreground",
  revoked: "bg-destructive/12 text-destructive",
};

export default async function PartnerCertificates({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status)
    ? (status as CertificateStatus | "all")
    : "all";

  const [{ memberships }, rows] = await Promise.all([
    requirePartner(),
    getPartnerCertificates(filter === "all" ? undefined : filter),
  ]);

  const canApprove = memberships.some((m) => m.partner.kind === "blood_bank");
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle={
          canApprove
            ? `${rows.length} issued · ${pending} waiting on your sign-off`
            : `${rows.length} issued across your camps`
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/partner/certificates" : `/partner/certificates?status=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-app-line text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing here yet"
            body="A certificate is created automatically the moment a donation is recorded on the roster."
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
                  <tr key={c.id} className="border-b border-app-line-soft last:border-b-0">
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
                      <span
                        className={cn(
                          "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium capitalize",
                          TONE[c.status],
                        )}
                      >
                        {c.status}
                      </span>
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
                      <CertificateActions
                        certificateId={c.id}
                        status={c.status}
                        canApprove={canApprove}
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
