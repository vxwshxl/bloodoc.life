import { DetailList, type DetailItem } from "@/components/shell/detail-list";
import { DonorProfile } from "@/components/admin/donor-profile";
import { CertificateActions } from "@/components/partner/certificate-actions";
import {
  CertificatePreviewButton,
  SendCertificateButton,
  VerifyLink,
} from "@/components/admin/certificate-tools";
import { StatusPill } from "@/components/ui/status-pill";
import { formatCampDate, formatDateTime } from "@/lib/format";
import type { CertificateListRow } from "@/lib/certificates/queries";

/**
 * What a certificate row opens in the console: the certificate's facts, the
 * things to do with it, and the donor's whole record underneath.
 *
 * The actions sit above the profile rather than at the foot of it, so the
 * common case — open, approve or resend, close — needs no scrolling.
 */
export function CertificateOverview({ c }: { c: CertificateListRow }) {
  return (
    <div className="flex flex-col gap-3">
      <DetailList
        heading="Certificate"
        items={[
          ["Code", <span key="c" className="font-mono">{c.code}</span>],
          ["State", <StatusPill key="s" status={c.status} />],
          ["Issued", c.issued_at ? formatDateTime(c.issued_at) : "Not yet"],
          ["Camp", c.camp.title, { span: 2 }],
          ["Camp date", formatCampDate(c.camp.starts_at)],
          ["Emailed to donor", c.emailed_at ? formatDateTime(c.emailed_at) : "Not yet", { span: 2 }],
          ...(c.status === "revoked"
            ? ([["Withdrawn because", c.revoked_reason, { wide: true }]] as DetailItem[])
            : []),
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <CertificatePreviewButton cert={c.print} />
        <VerifyLink code={c.code} />
        <SendCertificateButton certificateId={c.id} approved={c.status === "approved"} />
        <div className="ml-auto">
          {/* An admin can approve anywhere; the policy in 0008 lets
              `is_admin()` through every certificate branch. */}
          <CertificateActions certificateId={c.id} status={c.status} canApprove />
        </div>
      </div>

      <DonorProfile donor={c.donor} />
    </div>
  );
}
