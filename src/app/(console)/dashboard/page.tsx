import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Droplet } from "lucide-react";
import { CampCard } from "@/components/camps/camp-card";
import { StatusPill } from "@/components/ui/status-pill";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { StatTile } from "@/components/admin/charts";
import { getEffectiveProfile, getEffectiveRecord } from "@/lib/auth/impersonation";
import { getFeaturedCamp, getUpcomingCamps } from "@/lib/camps/queries";
import { formatCampDate } from "@/lib/format";
import type { RegistrationRow } from "@/lib/admin/queries";
import type { Donor } from "@/lib/db/types";

export const metadata: Metadata = { title: "Overview" };

export default async function DonorOverview() {
  const [e, record, featured, upcoming] = await Promise.all([
    getEffectiveProfile(),
    getEffectiveRecord(),
    getFeaturedCamp(),
    getUpcomingCamps(),
  ]);

  const donor = (record.donor ?? null) as Donor | null;
  const registrations = record.registrations as RegistrationRow[];

  const donated = registrations.filter((r) => r.status === "donated").length;
  // Neither number alone is right: the first misses this year, the second
  // misses every donation made before they ever heard of BlooDoc.
  const lifetime = (donor?.prior_donations ?? 0) + donated;

  const registeredIds = new Set(
    registrations.filter((r) => r.status !== "cancelled").map((r) => r.camp_id),
  );
  const open = [featured, ...upcoming]
    .filter((c): c is NonNullable<typeof c> => !!c)
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i)
    .filter((c) => !registeredIds.has(c.id));

  return (
    <>
      <PageHeader
        title={donor?.full_name ?? e?.profile.full_name ?? "Welcome"}
        subtitle={
          donor
            ? "Your record, your camps and your certificates."
            : "You do not have a donor record yet — one is created the first time you register."
        }
      />

      <Panel className="mb-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-app-line-soft sm:grid-cols-4">
          <StatTile
            label="Blood group"
            value={!donor || donor.blood_group === "unknown" ? "—" : donor.blood_group}
            hint={!donor || donor.blood_group === "unknown" ? "Tested free at the camp" : undefined}
            accent
          />
          <StatTile label="Donations" value={lifetime} hint={`${donated} of them with us`} />
          <StatTile label="Camps joined" value={registrations.length} />
          <StatTile
            label="Certificates"
            value={registrations.filter((r) => r.status === "donated").length}
          />
        </div>
      </Panel>

      {/* Camps they could still join. Skipped entirely when there are none —
          an empty "nothing available" card is a row of furniture. */}
      {open.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Open for registration
          </h2>
          {/* The same card the public site leads with — a date block you find
              by shape, then the detail. It was a plain row, which made the one
              action on this page look like another list item. */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {open.slice(0, 4).map((c) => (
              <CampCard
                key={c.id}
                camp={c}
                href={`/camps/${c.slug}#register`}
                action="Register to donate"
              />
            ))}
          </div>
        </>
      )}

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-app-line-soft px-5 py-4">
          <h2 className="text-sm font-semibold">Recent applications</h2>
          <Link
            href="/dashboard/applications"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            All applications →
          </Link>
        </div>
        {registrations.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            body="Register for a camp and it appears here with its outcome and, once you have given, your certificate."
          />
        ) : (
          <ul>
            {registrations.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  {r.status === "donated" ? (
                    <Droplet className="size-4" strokeWidth={2} aria-hidden />
                  ) : (
                    <CalendarDays className="size-4" strokeWidth={1.9} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.camp.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatCampDate(r.camp.starts_at)}
                  </span>
                </span>
                <StatusPill status={r.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
