import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { getOverview } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { formatCampDate, formatDateTime, formatTimeRange } from "@/lib/format";

const STATUS_TONE: Record<string, string> = {
  donated: "bg-primary/12 text-primary",
  screened: "bg-muted text-foreground",
  registered: "bg-muted text-muted-foreground",
  deferred: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export default async function OverviewPage() {
  const o = await getOverview();
  // The bars are drawn relative to the largest group, not to the total. With
  // nine groups and O+ at 40%, a total-relative bar leaves every other group as
  // an indistinguishable stub.
  const peak = Math.max(1, ...o.byGroup.map((g) => g.count));

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          o.nextCamp
            ? `Next camp: ${formatCampDate(o.nextCamp.starts_at)} at ${o.nextCamp.venue}`
            : "No camp is scheduled."
        }
        action={
          <Link
            href="/admin/camps"
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <CalendarDays className="size-4" strokeWidth={2} />
            Camps
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Donors on file", value: o.donors, hint: "unique people" },
          {
            label: "Registered for next",
            value: o.registeredForNext,
            hint: o.nextCamp?.capacity ? `of ${o.nextCamp.capacity} places` : "no capacity set",
            primary: true,
          },
          { label: "Donations recorded", value: o.donatedAllTime, hint: "all camps" },
          { label: "Camps", value: o.camps, hint: "draft, published and closed" },
        ].map((s) => (
          <Panel key={s.label} className="p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {s.label}
            </p>
            <p
              className={`mt-2 font-display text-3xl font-bold tracking-tight ${s.primary ? "text-primary" : ""}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </Panel>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Donors by blood group</h2>
          {o.byGroup.length === 0 ? (
            <EmptyState title="Nobody yet" body="Groups appear here as donors register." />
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {o.byGroup.map((g) => (
                <li key={g.group} className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-12 shrink-0 items-center justify-center rounded-md bg-primary/12 text-xs font-bold text-primary">
                    {g.group === "unknown" ? "?" : g.group}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(g.count / peak) * 100}%` }}
                    />
                  </span>
                  <span
                    className="w-10 text-right text-sm font-medium"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {g.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-app-line-soft px-5 py-4">
            <h2 className="text-sm font-semibold">Latest registrations</h2>
            <Link
              href="/admin/registrations"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {o.recent.length === 0 ? (
            <EmptyState
              title="No registrations yet"
              body="They will appear here the moment somebody submits the form on the site."
            />
          ) : (
            <ul>
              {o.recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.donor.full_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {r.camp.title} · {formatDateTime(r.created_at)}
                    </span>
                  </span>
                  <span className="inline-flex h-6 min-w-9 shrink-0 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                    {r.donor.blood_group === "unknown" ? "?" : r.donor.blood_group}
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium capitalize ${STATUS_TONE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {o.nextCamp && (
        <Panel className="mt-6 p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Next camp
          </p>
          <p className="mt-2 font-display text-xl font-bold tracking-tight">{o.nextCamp.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCampDate(o.nextCamp.starts_at)} ·{" "}
            {formatTimeRange(o.nextCamp.starts_at, o.nextCamp.ends_at)} · {o.nextCamp.venue}
          </p>
        </Panel>
      )}
    </>
  );
}
