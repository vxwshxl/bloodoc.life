import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveProfile, getEffectiveRecord } from "@/lib/auth/impersonation";
import { verifyCertificate, type VerifiedCertificate } from "@/lib/partners/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { CertificateGrid } from "@/components/me/certificate-grid";

export const metadata: Metadata = { title: "Certificates" };

export default async function DonorCertificates() {
  const [e, record] = await Promise.all([getEffectiveProfile(), getEffectiveRecord()]);
  const registrationIds = (record.registrations as { id: string }[]).map((r) => r.id);

  // Scoped to the registrations of whoever the page is rendering for. Leaning
  // on RLS alone was wrong under "view as": the administrator's own session
  // matches every certificate on the site, so the donor's page listed all of
  // them. Under "view as" the read goes through the service role, exactly as
  // `getEffectiveRecord` does, and the id list is what keeps it to one donor.
  const supabase = e?.viewingAs ? createAdminClient() : await createClient();
  const { data } = registrationIds.length
    ? await supabase
        .from("certificates")
        .select("code, status")
        .in("registration_id", registrationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const rows = (data as { code: string; status: string }[] | null) ?? [];
  const waiting = rows.filter((r) => r.status === "pending").length;

  // Only signed-off certificates are shown. A pending one is not yet proof of
  // anything, and a revoked one never will be again.
  const certs = (
    await Promise.all(
      rows.filter((r) => r.status === "approved").map((r) => verifyCertificate(r.code)),
    )
  ).filter((c): c is VerifiedCertificate => c !== null && c.status === "approved");

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle={
          certs.length === 0
            ? waiting > 0
              ? `${waiting} awaiting sign-off from the blood bank.`
              : "You get one for every donation."
            : `${certs.length} verified${waiting > 0 ? ` · ${waiting} awaiting sign-off` : ""}`
        }
      />

      {certs.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing yet"
            body={
              waiting > 0
                ? "Your certificate appears here once the blood bank signs it off. It usually takes a day or two."
                : "Once you donate and the blood bank signs it off, your certificate appears here."
            }
          />
        </Panel>
      ) : (
        <CertificateGrid certs={certs} />
      )}
    </>
  );
}
