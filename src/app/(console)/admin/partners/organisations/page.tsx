import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PartnerGrid } from "@/components/admin/partner-grid";
import { NewPartnerForm } from "@/components/admin/partner-manager";
import { listPartners } from "@/lib/partners/queries";

export const metadata: Metadata = { title: "Organisations" };

export default async function Page() {
  const partners = (await listPartners()).filter((p) => p.kind === "organisation");

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle="The bodies that mobilise donors and run the drives."
        action={<NewPartnerForm />}
      />
      <PartnerGrid
        partners={partners}
        empty={{ title: "No organisations yet", body: "Add the NSS units and service organisations that bring donors to a camp." }}
      />
    </>
  );
}
