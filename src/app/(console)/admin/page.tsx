import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Droplet } from "lucide-react";
import { getOverview, getDashboardExtras } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { BreakdownBars, StatTile, TrendChart } from "@/components/admin/charts";
import { formatCampDate, formatDateTime, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

/**
 * Reserved status colours, and only for the statuses that genuinely carry a
 * state: a donation is the good outcome, a deferral is the one somebody has to
 * act on. The neutral middle stays neutral rather than being given a hue it
 * does not mean. Every bar is labelled, so none of this is colour alone.
 */
const STATUS_TONE: Record<string, string> = {
  Donated: "var(--primary)",
  Deferred: "var(--destructive)",
  Cancelled: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)",
  Screened: "color-mix(in oklch, var(--primary) 55%, transparent)",
  Registered: "color-mix(in oklch, var(--primary) 30%, transparent)",
};

export default async function OverviewPage() {
  const [o, x] = await Promise.all([getOverview(), getDashboardExtras()]);

  const totalRegistrations = x.byStatus.reduce((n, s) => n + s.value, 0);
  const groups = o.byGroup
    .filter((g) => g.group !== "unknown")
    .map((g) => ({ label: g.group, value: g.count }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          o.nextCamp
            ? `Next camp ${formatCampDate(o.nextCamp.starts_at)} · ${o.registeredForNext} registered`
            : "No camp on the calendar yet."
        }
      />

      <Panel className="mb-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-app-line-soft lg:grid-cols-4">
          <StatTile label="Donors" value={o.donors} hint="people on file" />
          <StatTile label="Registrations" value={totalRegistrations} hint="across every camp" />
          <StatTile label="Units collected" value={o.donatedAllTime} hint="all time" accent />
          <StatTile
            label="Certificates"
            value={x.certificates.approved}
            hint={
              x.certificates.pending > 0
                ? `${x.certificates.pending} awaiting approval`
                : "all signed off"
            }
          />
        </div>
      </Panel>

      {/* The one thing that needs doing, and only when it does. */}
      {x.certificates.pending > 0 && (
        <Panel className="mb-5">
          <Link
            href="/admin/certificates?status=pending"
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <span className="flex items-center gap-3">
              <BadgeCheck className="size-5 text-primary" strokeWidth={1.9} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">
                  {x.certificates.pending} certificate
                  {x.certificates.pending === 1 ? "" : "s"} waiting for approval
                </span>
                <span className="block text-xs text-muted-foreground">
                  Donors cannot download theirs until it is signed off.
                </span>
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </Panel>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Registrations, last 30 days</h2>
            <span className="text-xs text-muted-foreground">
              {x.trend.reduce((n, t) => n + t.value, 0)} in the window
            </span>
          </div>
          <TrendChart data={x.trend} label="registrations" />
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Where they got to</h2>
          <BreakdownBars
            data={x.byStatus}
            tone={(d) => STATUS_TONE[d.label] ?? "var(--primary)"}
          />
          <p className="mt-4 border-t border-app-line-soft pt-3 text-xs text-muted-foreground">
            Every registration ever taken, by its outcome.
          </p>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Blood groups on file</h2>
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No groups recorded yet.
            </p>
          ) : (
            <BreakdownBars data={groups} />
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Partners</h2>
          <div className="flex flex-col gap-3">
            <Link
              href="/admin/partners/blood-banks"
              className="flex items-center gap-3 rounded-xl border border-app-line-soft px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Droplet className="size-4.5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{x.partners.bloodBanks}</span>
                <span className="block text-xs text-muted-foreground">Blood banks</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
            <Link
              href="/admin/partners/organisations"
              className="flex items-center gap-3 rounded-xl border border-app-line-soft px-4 py-3 transition-colors hover:bg-muted"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-4.5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{x.partners.organisations}</span>
                <span className="block text-xs text-muted-foreground">Organisations</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Next camp</h2>
          {o.nextCamp ? (
            <>
              <p className="font-display text-lg leading-tight font-bold tracking-tight text-balance">
                {o.nextCamp.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatCampDate(o.nextCamp.starts_at)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatTimeRange(o.nextCamp.starts_at, o.nextCamp.ends_at)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{o.nextCamp.venue}</p>
              <Link
                href={`/admin/registrations?camp=${o.nextCamp.id}`}
                className="press mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
              >
                {o.registeredForNext} on the roster
              </Link>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing scheduled. Create a camp and publish it.
            </p>
          )}
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-app-line-soft px-5 py-4">
          <h2 className="text-sm font-semibold">Latest registrations</h2>
          <Link
            href="/admin/registrations"
            className="text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            All registrations →
          </Link>
        </div>
        {o.recent.length === 0 ? (
          <EmptyState
            title="Nobody yet"
            body="Registrations arrive here the moment somebody submits the form on the site."
          />
        ) : (
          <ul>
            {o.recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0"
              >
                <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                  {r.donor.blood_group === "unknown" ? "?" : r.donor.blood_group}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.donor.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.camp.title} · {formatDateTime(r.created_at)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-xs font-medium capitalize",
                    r.status === "donated"
                      ? "bg-primary/12 text-primary"
                      : r.status === "deferred"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-muted text-muted-foreground",
                  )}
                >
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
