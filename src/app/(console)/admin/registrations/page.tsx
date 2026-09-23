import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { listCampRosters, listCamps, listRegistrations } from "@/lib/admin/queries";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
} from "@/components/shell/pagination";
import { StatusControl } from "@/components/admin/registration-row";
import { VitalsCell } from "@/components/admin/vitals-cell";
import { DeleteRow } from "@/components/shell/delete-row";
import { canDeleteRegistrations } from "@/lib/records/queries";
import { RegistrationRowLink } from "@/components/admin/registration-row-link";
import { StatusPill } from "@/components/ui/status-pill";
import { formatTimeRange } from "@/lib/format";
import { formatCampDateShort, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Registrations" };

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string; page?: string; q?: string; all?: string }>;
}) {
  const { camp: campId, page: pageParam, q, all } = await searchParams;
  const page = pageFromParams(pageParam);

  /**
   * Camps first, rows second.
   *
   * One table of every registration ever taken answers a question nobody at a
   * camp has. The work is always "who is on today's roster" — and with four
   * camps on file the flat list was already interleaving three of them, so the
   * first thing anybody did on arriving was set the camp filter. This makes
   * that the page instead of the first step of using it.
   *
   * Searching still spans every camp, because "find Arnab" is exactly the case
   * where you do not know which roster he is on. `?all=1` keeps the flat view
   * for anybody who wants it.
   */
  const showIndex = !campId && !q?.trim() && all !== "1";

  if (showIndex) {
    const rosters = await listCampRosters();
    const totalAll = rosters.reduce((n, c) => n + c.total, 0);

    return (
      <>
        <PageHeader
          title="Registrations"
          subtitle={`${totalAll} across ${rosters.length} camp${rosters.length === 1 ? "" : "s"}`}
        />

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SearchBox
            placeholder="Donor name, email or phone — across every camp"
            clearHref="/admin/registrations"
          />
          <Link
            href="/admin/registrations?all=1"
            className="press inline-flex h-9 shrink-0 items-center rounded-lg border border-app-line px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            One long list
          </Link>
        </div>

        {rosters.length === 0 ? (
          <Panel>
            <EmptyState
              title="No camps yet"
              body="Registrations belong to a camp. Create one on the Camps page and its roster appears here."
            />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rosters.map((c) => (
              <Link
                key={c.id}
                href={`/admin/registrations?camp=${c.id}`}
                className="press group flex flex-col rounded-2xl border border-app-line-soft bg-card p-5 shadow-card transition-colors hover:border-primary/40"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-display text-base font-semibold tracking-tight">
                      {c.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                      {formatCampDateShort(c.starts_at)} ·{" "}
                      {formatTimeRange(c.starts_at, c.ends_at)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                      <span className="truncate">{[c.venue, c.city].filter(Boolean).join(", ")}</span>
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>

                <span className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums">{c.total}</span>
                  <span className="text-xs text-muted-foreground">
                    on the roster
                  </span>
                </span>

                {/* Outcomes, not a second copy of the total. A camp with 37
                    registered and 2 donated is a different morning from one
                    with 37 and 30, and that is the thing worth seeing before
                    opening it. */}
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {(["donated", "screened", "registered", "deferred", "cancelled"] as const)
                    .filter((k) => c.byStatus[k] > 0)
                    .map((k) => (
                      <StatusPill key={k} status={k} count={c.byStatus[k]} />
                    ))}
                  {c.total === 0 && (
                    <span className="text-xs text-muted-foreground">Nobody has registered yet.</span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </>
    );
  }

  const [camps, { rows, total }, canDelete] = await Promise.all([
    listCamps(),
    listRegistrations(campId, page, DEFAULT_PAGE_SIZE, q),
    canDeleteRegistrations(),
  ]);
  const active = camps.find((c) => c.id === campId) ?? null;

  // Scoped to the page, and labelled as such below. These used to be totals
  // because the query returned everything; now that it returns 25 rows,
  // presenting them as totals would quietly understate every camp.
  const firstTimers = rows.filter((r) => r.first_time).length;
  const donated = rows.filter((r) => r.status === "donated").length;

  return (
    <>
      <Link
        href="/admin/registrations"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> All camps
      </Link>

      <PageHeader
        title={active ? active.title : "Registrations"}
        subtitle={
          active
            ? `${formatCampDateShort(active.starts_at)} · ${total} on the roster · ${donated} donated, ${firstTimers} first-timers on this page`
            : `${total} across every camp`
        }
      />

      <div className="mb-4">
        <SearchBox
          placeholder="Donor name, email or phone"
          defaultValue={q}
          keep={{ camp: campId }}
          clearHref="/admin/registrations"
        />
      </div>

      {/* A menu, not a pill per camp. The pill strip was fine at two camps and
          unusable at twenty — it wrapped to four lines and pushed the table off
          the screen, and the one you wanted was somewhere in the middle. The
          cost of a pill strip grows with the data; a menu's does not. The
          filter still lives in the URL, so a roster is still a link somebody
          can send to the desk. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterMenu
          label="Camp"
          paramName="camp"
          active={campId}
          options={camps.map((c) => ({
            value: c.id,
            label: c.title,
            hint: formatCampDateShort(c.starts_at),
          }))}
        />
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nobody yet"
            body="Registrations arrive here the moment somebody submits the form on the site."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          {/* One DOM, not two. Below `sm` the table reflows to stacked blocks
              rather than a duplicate mobile list — a second block would read
              the whole roster twice to a screen reader. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-app-line-soft">
                  {["Donor", "Group", "History", "Screening", "Camp", "Status", ""].map((h, i) => (
                    <th
                      key={h || i}
                      className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <RegistrationRowLink key={r.id} registration={r} canEdit>
                    <td className="px-5 py-3">
                      <span className="block font-medium">{r.donor.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.donor.kind === "other"
                          ? r.donor.occupation || "–"
                          : `${r.donor.kind}${r.donor.department ? ` · ${r.donor.department}` : ""}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.donor.phone} · {r.donor.email}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
                        {r.donor.blood_group === "unknown" ? "?" : r.donor.blood_group}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {r.first_time ? (
                        <span className="font-medium text-foreground">First time</span>
                      ) : (
                        `${r.donor.prior_donations} before`
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <VitalsCell reg={r} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <span className="block max-w-40 truncate">{r.camp.title}</span>
                      <span className="block">{formatDateTime(r.created_at)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusControl id={r.id} status={r.status} reason={r.deferral_reason} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canDelete && (
                        <DeleteRow
                          table="registrations"
                          id={r.id}
                          name={`${r.donor.full_name} at ${r.camp.title}`}
                          kind="registration"
                          consequences={[
                            "the screening readings taken on the day",
                            ...(r.status === "donated"
                              ? ["the certificate for this donation, and its code at /verify"]
                              : []),
                          ]}
                          instead={
                            <>
                              If they simply did not come, set the status to{" "}
                              <span className="font-medium text-foreground">cancelled</span>{" "}
                              instead — that keeps the record and the count.
                            </>
                          }
                        />
                      )}
                    </td>
                  </RegistrationRowLink>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            basePath="/admin/registrations"
            params={{ camp: campId, q }}
            unit="registration"
          />
        </Panel>
      )}
    </>
  );
}
