import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Droplet, Mail, Phone } from "lucide-react";
import { requireUser, getProfile } from "@/lib/auth/dal";
import { getMyRecord } from "@/lib/admin/queries";
import { getNextCamp } from "@/lib/camps/queries";
import { TopNav } from "@/components/site/top-nav";
import { SiteFooter } from "@/components/site/footer";
import { Panel } from "@/components/shell/page-header";
import { signOut } from "@/lib/auth/actions";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { CONTACT_EMAIL, CONTACT_EMAIL_HREF, CONTACT_PHONE } from "@/lib/brand-contact";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Your donor record",
  robots: { index: false, follow: false },
};

const STATUS_TONE: Record<string, string> = {
  donated: "bg-primary/12 text-primary",
  screened: "bg-muted text-foreground",
  registered: "bg-muted text-muted-foreground",
  deferred: "bg-destructive/12 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function MePage() {
  await requireUser();
  const [profile, { donor, registrations }, nextCamp] = await Promise.all([
    getProfile(),
    getMyRecord(),
    getNextCamp(),
  ]);

  const donated = registrations.filter((r) => r.status === "donated").length;
  // The lifetime figure is what they told us plus what we have watched happen.
  // Neither number alone is right: the first misses this year, the second
  // misses every donation made before they ever heard of BlooDoc.
  const lifetime = (donor?.prior_donations ?? 0) + donated;
  const registeredForNext =
    nextCamp && registrations.some((r) => r.camp_id === nextCamp.id && r.status !== "cancelled");

  return (
    <>
      <main className="relative z-10 flex flex-1 flex-col bg-background">
        <TopNav activeIndex={null} dashboardHref={profile?.role === "admin" ? "/admin" : null} />

        <div className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Your record
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {donor?.full_name ?? profile?.full_name ?? "Welcome"}
              </h1>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="press h-9 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                Sign out
              </button>
            </form>
          </div>

          {!donor ? (
            <Panel className="mt-8 p-8 text-center">
              <p className="font-display text-lg font-semibold tracking-tight">
                Nothing here yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Your donor record is created the first time you register for a
                camp. It takes about two minutes and you never fill it again.
              </p>
              <Link
                href="/#camp"
                className="press mt-6 inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                Register for a camp
              </Link>
            </Panel>
          ) : (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <Panel className="p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Blood group
                  </p>
                  <p className="mt-2 font-display text-3xl font-bold tracking-tight text-primary">
                    {donor.blood_group === "unknown" ? "Not known" : donor.blood_group}
                  </p>
                  {donor.blood_group === "unknown" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      It is tested free at the camp.
                    </p>
                  )}
                </Panel>
                <Panel className="p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Donations
                  </p>
                  <p
                    className="mt-2 font-display text-3xl font-bold tracking-tight"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {lifetime}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {donated} of them with us
                  </p>
                </Panel>
                <Panel className="p-5">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Next camp
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {nextCamp ? formatCampDate(nextCamp.starts_at) : "None scheduled"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {nextCamp
                      ? registeredForNext
                        ? "You are on the roster."
                        : "You have not registered."
                      : "We will write when one is fixed."}
                  </p>
                </Panel>
              </div>

              {nextCamp && !registeredForNext && (
                <Link
                  href="/#camp"
                  className="press mt-4 flex items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 transition-colors hover:bg-primary/8"
                >
                  <span>
                    <span className="block text-sm font-semibold">{nextCamp.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatCampDate(nextCamp.starts_at)} ·{" "}
                      {formatTimeRange(nextCamp.starts_at, nextCamp.ends_at)} · {nextCamp.venue}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-primary">Register →</span>
                </Link>
              )}

              <Panel className="mt-6 p-5 sm:p-6">
                <h2 className="text-sm font-semibold">Your details</h2>
                <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {[
                    ["Name", donor.full_name],
                    ["Sex", donor.sex],
                    ["Age", donor.age ? String(donor.age) : "—"],
                    ["Date of birth", donor.date_of_birth ?? "—"],
                    ["Father's name", donor.father_name ?? "—"],
                    ["Mother's name", donor.mother_name ?? "—"],
                    ["You are", donor.kind],
                    ["Department", donor.department ?? "—"],
                    ["Email", donor.email],
                    ["Phone", donor.phone],
                    ["Alternate phone", donor.alt_phone ?? "—"],
                    ["Address", donor.address ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-app-line-soft py-2 last:border-b-0">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="text-right text-sm font-medium capitalize">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Something wrong? Correct it when you register for the next camp
                  — the form is pre-filled from this record and saving it updates
                  this page. Or{" "}
                  <a href="mailto:hello@bloodoc.life" className="font-medium text-foreground underline underline-offset-4">
                    write to us
                  </a>
                  .
                </p>
              </Panel>

              <Panel className="mt-6 overflow-hidden">
                <div className="border-b border-app-line-soft px-5 py-4">
                  <h2 className="text-sm font-semibold">Your camps</h2>
                </div>
                {registrations.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No camps on your record yet.
                  </p>
                ) : (
                  <ul>
                    {registrations.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-4 border-b border-app-line-soft px-5 py-4 last:border-b-0"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                          {r.status === "donated" ? (
                            <Droplet className="size-4.5" strokeWidth={2} />
                          ) : (
                            <CalendarDays className="size-4.5" strokeWidth={1.9} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{r.camp.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatCampDate(r.camp.starts_at)} · {r.camp.venue}
                          </span>
                          {r.status === "deferred" && r.deferral_reason && (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Deferred: {r.deferral_reason}
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 text-xs font-medium capitalize",
                            STATUS_TONE[r.status],
                          )}
                        >
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <a
                  href={CONTACT_EMAIL_HREF}
                  className="inline-flex items-center gap-2 hover:text-foreground"
                >
                  <Mail className="size-4" strokeWidth={1.9} /> {CONTACT_EMAIL}
                </a>
                <a
                  href={`tel:+${CONTACT_PHONE.digits}`}
                  className="inline-flex items-center gap-2 hover:text-foreground"
                >
                  <Phone className="size-4" strokeWidth={1.9} /> {CONTACT_PHONE.label}
                </a>
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
