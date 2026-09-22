import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Droplet } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { BreakdownBars, StatTile, TrendChart } from "@/components/admin/charts";
import { getEffectiveProfile } from "@/lib/auth/impersonation";
import {
  getPartnerCamps,
  getPartnerDashboard,
  getPartnerSummary,
} from "@/lib/partners/queries";
import { formatCampDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

/**
 * Reserved status colours, and only where the status genuinely carries a
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

export default async function PartnerOverview() {
  const [effective, camps, summary, dash] = await Promise.all([
    getEffectiveProfile(),
    getPartnerCamps(),
    getPartnerSummary(),
    getPartnerDashboard(),
  ]);
  const memberships = effective?.memberships ?? [];

  // The capacity this account acts in. A body that is the blood bank at any of
  // its camps gets the clinical language; one that never is gets the
  // mobilisation view. Per-camp truth still lives in RLS.
  const isBloodBank = memberships.some((m) => m.partner.kind === "blood_bank");
  const inWindow = dash.trend.reduce((n, t) => n + t.value, 0);

  return (
    <>
      <PageHeader
        title={memberships.length === 1 ? memberships[0].partner.name : "Your camps"}
        subtitle={
          isBloodBank
            ? "Units received, and the certificates waiting on your sign-off."
            : "Donors your organisation brought in, across every camp you run."
        }
      />

      {/* Who you are here. Worth stating: a coordinator who belongs to two
          bodies otherwise has to infer it from the roster. */}
      <div className="mb-5 flex flex-wrap gap-2">
        {memberships.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-2 rounded-full border border-app-line px-3 py-1.5 text-xs font-medium"
          >
            {m.partner.kind === "blood_bank" ? (
              <Droplet className="size-3.5 text-primary" strokeWidth={2} aria-hidden />
            ) : (
              <Building2 className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
            )}
            {m.partner.short_name ?? m.partner.name}
            <span className="text-muted-foreground">
              · {m.partner.kind === "blood_bank" ? "Blood bank" : "Organisation"}
            </span>
          </span>
        ))}
      </div>

      <Panel className="mb-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-app-line-soft lg:grid-cols-4">
          <StatTile label="On roster" value={summary.total} hint="across your camps" />
          <StatTile label="Units collected" value={summary.donated} accent hint="all time" />
          <StatTile label="First-timers" value={dash.firstTimers} hint="never given before" />
          <StatTile
            label="Certificates"
            value={summary.certificatesApproved}
            hint={
              summary.certificatesPending > 0
                ? `${summary.certificatesPending} awaiting approval`
                : "all signed off"
            }
          />
        </div>
      </Panel>

      {isBloodBank && summary.certificatesPending > 0 && (
        <Panel className="mb-5">
          <Link
            href="/partner/certificates?status=pending"
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <span className="flex items-center gap-3">
              <BadgeCheck className="size-5 text-primary" strokeWidth={1.9} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">
                  {summary.certificatesPending} certificate
                  {summary.certificatesPending === 1 ? "" : "s"} waiting for approval
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
            <span className="text-xs text-muted-foreground">{inWindow} in the window</span>
          </div>
          <TrendChart data={dash.trend} label="registrations" />
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Where they got to</h2>
          <BreakdownBars
            data={dash.byStatus.map((d) => ({
              ...d,
              color: STATUS_TONE[d.label] ?? "var(--primary)",
            }))}
          />
          <p className="mt-4 border-t border-app-line-soft pt-3 text-xs text-muted-foreground">
            {isBloodBank
              ? "You record these at the desk on the day."
              : "Recorded by the blood bank running the camp."}
          </p>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Blood groups on your rosters</h2>
          {dash.byGroup.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No groups recorded yet.
            </p>
          ) : (
            <BreakdownBars data={dash.byGroup} />
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Camps</h2>
          {camps.length === 0 ? (
            <EmptyState
              title="No camps yet"
              body="When an administrator attaches your organisation to a camp, it appears here with its roster."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {camps.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/partner/registrations?camp=${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-app-line-soft px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatCampDateShort(c.starts_at)} · {c.venue}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
                      {c.role === "blood_bank" ? "Blood bank" : "Organiser"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
