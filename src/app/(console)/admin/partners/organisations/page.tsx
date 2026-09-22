import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { PartnerGrid } from "@/components/admin/partner-grid";
import { NewPartnerForm } from "@/components/admin/partner-manager";
import { listPartners } from "@/lib/partners/queries";

export const metadata: Metadata = { title: "Organisations" };

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
    .filter((p) => p.kind === "organisation")
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
        title="Organisations"
        subtitle="The bodies that mobilise donors and run the drives."
        action={<NewPartnerForm />}
      />

      <div className="mb-5">
        <SearchBox
          placeholder="Name, institution or city"
          defaultValue={q}
          clearHref="/admin/partners/organisations"
        />
      </div>
      <PartnerGrid
        partners={partners}
        empty={{ title: "No organisations yet", body: "Add the NSS units and service organisations that bring donors to a camp." }}
      />
    </>
  );
}
