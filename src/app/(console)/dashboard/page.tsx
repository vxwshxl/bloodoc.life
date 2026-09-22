import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Droplet, MapPin } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { StatTile } from "@/components/admin/charts";
import { getEffectiveProfile, getEffectiveRecord } from "@/lib/auth/impersonation";
import { getFeaturedCamp, getUpcomingCamps } from "@/lib/camps/queries";
import { campDateParts, formatCampDate, formatTimeRange } from "@/lib/format";
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
            {open.slice(0, 4).map((c) => {
              const d = campDateParts(c.starts_at);
              return (
                <Link
                  key={c.id}
                  href={`/camps/${c.slug}#register`}
                  className="group/card press grain flex cursor-pointer items-start gap-4 rounded-2xl border border-app-line-soft bg-card p-5 shadow-card transition-[border-color] select-none hover:border-primary/40"
                >
                  <span className="flex shrink-0 flex-col items-center">
                    <span
                      className="font-display text-3xl leading-none font-black tracking-tighter text-primary"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {d.day}
                    </span>
                    <span className="mt-1 text-[0.625rem] font-bold tracking-[0.14em] text-foreground">
                      {d.month}
                    </span>
                    <span className="text-[0.625rem] text-muted-foreground">{d.year}</span>
                  </span>

                  <span aria-hidden className="w-px self-stretch bg-app-line-soft" />

                  <span className="min-w-0 flex-1">
                    <span className="font-display block text-base leading-tight font-bold tracking-tight text-balance">
                      {c.title}
                    </span>
                    <span className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="flex items-start gap-1.5">
                        <Clock className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                        {d.weekday} · {formatTimeRange(c.starts_at, c.ends_at)}
                      </span>
                      <span className="flex items-start gap-1.5">
                        <MapPin className="mt-px size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                        <span className="min-w-0">
                          {c.venue}
                          {c.city ? `, ${c.city}` : ""}
                        </span>
                      </span>
                    </span>
                    <span className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                      Register to donate
                      <ArrowRight
                        className="size-3.5 transition-transform duration-300 ease-out-strong group-hover/card:translate-x-0.5"
                        strokeWidth={2.2}
                        aria-hidden
                      />
                    </span>
                  </span>
                </Link>
              );
            })}
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
                <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize">
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
