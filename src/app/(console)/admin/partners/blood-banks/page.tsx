import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { PartnerGrid } from "@/components/admin/partner-grid";
import { NewPartnerForm } from "@/components/admin/partner-manager";
import { listPartners } from "@/lib/partners/queries";

export const metadata: Metadata = { title: "Blood banks" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim().toLowerCase();
  // Filtered in memory rather than in the query: a deployment has a handful of
  // partners, not thousands, and matching the parent institution and city as
  // well is one line here against a three-column `or` in PostgREST.
  const partners = (await listPartners())
    .filter((p) => p.kind === "blood_bank")
    .filter(
      (p) =>
        !term ||
        [p.name, p.short_name, p.parent_institution, p.city]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(term)),
    );

  return (
    <>
      <PageHeader
        title="Blood banks"
        subtitle="The bodies that receive the units and sign off certificates."
        action={<NewPartnerForm />}
      />

      <div className="mb-5">
        <SearchBox
          placeholder="Name, institution or city"
          defaultValue={q}
          clearHref="/admin/partners/blood-banks"
        />
      </div>
      <PartnerGrid
        partners={partners}
        empty={{ title: "No blood banks yet", body: "Add the blood centre that receives the units. Only a blood bank can record a donation or approve a certificate." }}
      />
    </>
  );
}
