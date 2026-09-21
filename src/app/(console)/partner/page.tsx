import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Droplet } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { requirePartner } from "@/lib/auth/dal";
import { getPartnerCamps, getPartnerSummary } from "@/lib/partners/queries";
import { formatCampDateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Overview" };

/** One number and what it counts. Deliberately not a shared component yet. */
function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className="font-display mt-1 text-3xl font-bold tracking-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default async function PartnerOverview() {
  const { memberships } = await requirePartner();
  const [camps, summary] = await Promise.all([getPartnerCamps(), getPartnerSummary()]);

  // The capacity this account acts in. A body that is the blood bank at any of
  // its camps gets the clinical language and the desk controls; one that never
  // is gets the mobilisation view. Per-camp truth still lives in RLS.
  const isBloodBank = memberships.some((m) => m.partner.kind === "blood_bank");

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
        <div className="grid grid-cols-2 divide-x divide-y divide-app-line-soft sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="On roster" value={summary.total} />
          <Stat label="Registered" value={summary.registered} hint="not yet screened" />
          <Stat label="Screened" value={summary.screened} />
          <Stat label="Donated" value={summary.donated} hint="units collected" />
          <Stat label="Deferred" value={summary.deferred} hint="turned away" />
        </div>
      </Panel>

      {/* The one thing that needs doing, and only when it does. A zero here is
          not worth a card telling somebody there is nothing to approve. */}
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

      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Camps
      </h2>

      {camps.length === 0 ? (
        <Panel>
          <EmptyState
            title="No camps yet"
            body="When an administrator attaches your organisation to a camp, it appears here with its roster."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {camps.map((c) => (
            <Panel key={c.id}>
              <Link href={`/partner/registrations?camp=${c.id}`} className="block px-5 py-4">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatCampDateShort(c.starts_at)} · {c.venue}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide uppercase">
                    {c.role === "blood_bank" ? "Blood bank" : "Organiser"}
                  </span>
                </span>
              </Link>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
