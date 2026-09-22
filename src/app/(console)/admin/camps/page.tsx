import type { Metadata } from "next";
import Link from "next/link";
import { listCampsWithCounts } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { NewCampPanel } from "@/components/admin/camp-form";
import { CampRow } from "@/components/admin/camp-row";
import { formatCampDate, formatTimeRange } from "@/lib/format";

export const metadata: Metadata = { title: "Camps" };

export default async function CampsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const camps = await listCampsWithCounts(q);

  return (
    <>
      <PageHeader
        title="Camps"
        subtitle="A camp is visible on the site only while it is published."
        action={<NewCampPanel />}
      />

      <div className="mb-5">
        <SearchBox
          placeholder="Camp title, venue or city"
          defaultValue={q}
          clearHref="/admin/camps"
        />
      </div>

      {camps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No camps yet"
            body="Create one, publish it, and the home page will lead with it."
          />
        </Panel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {camps.map((camp) => (
            <CampRow
              key={camp.id}
              camp={camp}
              when={`${formatCampDate(camp.starts_at)} · ${formatTimeRange(camp.starts_at, camp.ends_at)}`}
              registrationCount={camp.registrationCount}
              certificateCount={camp.certificateCount}
            />
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Looking for who signed up?{" "}
        <Link href="/admin/registrations" className="font-medium text-foreground underline underline-offset-4">
          Registrations
        </Link>
        .
      </p>
    </>
  );
}
