import type { Metadata } from "next";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { getPartnerCamps } from "@/lib/partners/queries";
import { CampCard, CampTag } from "@/components/camps/camp-card";

export const metadata: Metadata = { title: "Camps" };

export default async function PartnerCamps() {
  const camps = await getPartnerCamps();

  return (
    <>
      <PageHeader
        title="Camps"
        subtitle={`${camps.length} camp${camps.length === 1 ? "" : "s"} your organisation is attached to`}
      />

      {camps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No camps yet"
            body="An administrator attaches your organisation to a camp. It appears here as soon as they do."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {camps.map((c) => (
            <CampCard
              key={c.id}
              camp={c}
              href={`/partner/registrations?camp=${c.id}`}
              action="Open roster"
              badge={<CampTag>{c.role === "blood_bank" ? "Blood bank" : "Organiser"}</CampTag>}
            />
          ))}
        </div>
      )}
    </>
  );
}
