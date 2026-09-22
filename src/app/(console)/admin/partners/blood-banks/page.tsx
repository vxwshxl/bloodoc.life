import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PartnerGrid } from "@/components/admin/partner-grid";
import { NewPartnerForm } from "@/components/admin/partner-manager";
import { listPartners } from "@/lib/partners/queries";

export const metadata: Metadata = { title: "Blood banks" };

export default async function Page() {
  const partners = (await listPartners()).filter((p) => p.kind === "blood_bank");

  return (
    <>
      <PageHeader
        title="Blood banks"
        subtitle="The bodies that receive the units and sign off certificates."
        action={<NewPartnerForm />}
      />
      <PartnerGrid
        partners={partners}
        empty={{ title: "No blood banks yet", body: "Add the blood centre that receives the units. Only a blood bank can record a donation or approve a certificate." }}
      />
    </>
  );
}
