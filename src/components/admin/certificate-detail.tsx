import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DetailList, type DetailItem } from "@/components/shell/detail-list";
import { formatCampDate, formatDateTime } from "@/lib/format";
import type { CertificateStatus } from "@/lib/db/types";

/** The fields both certificate tables already select. */
export type CertificateDetailData = {
  code: string;
  status: CertificateStatus;
  issued_at: string | null;
  revoked_reason: string | null;
  registration: {
    donor: { full_name: string; blood_group: string } | null;
    camp: { title: string; starts_at: string } | null;
  } | null;
};

/** The overview a certificate row opens, in the admin and partner consoles. */
export function CertificateDetail({ c }: { c: CertificateDetailData }) {
  const donor = c.registration?.donor;
  const camp = c.registration?.camp;
  return (
    <div className="flex flex-col gap-5">
      <DetailList
        items={[
          ["Donor", donor?.full_name],
          ["Blood group", !donor || donor.blood_group === "unknown" ? "Not known" : donor.blood_group],
          ["Camp", camp?.title, { wide: true }],
          ["Camp date", camp ? formatCampDate(camp.starts_at) : null],
          ["Code", <span key="c" className="font-mono">{c.code}</span>],
          ["Issued", c.issued_at ? formatDateTime(c.issued_at) : "Not yet"],
          ...(c.status === "revoked"
            ? ([["Revoked because", c.revoked_reason, { wide: true }]] as DetailItem[])
            : []),
        ]}
      />
      <Link
        href={`/verify/${c.code}`}
        target="_blank"
        className="press inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-app-line px-4 text-sm font-semibold transition-colors hover:bg-muted"
      >
        Open at /verify
        <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}
