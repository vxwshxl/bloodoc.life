import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Check,
  ClipboardCheck,
  Droplet,
  Minus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { getRoleCounts } from "@/lib/admin/queries";
import { getDeleteScope } from "@/lib/records/queries";
import { DeleteScopeControl } from "@/components/admin/delete-scope";
import { PageHeader, Panel } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Roles" };

/**
 * What each role can do — read only, on purpose.
 *
 * This page is a reference, not a control. The permissions below are not
 * configurable because they are not stored anywhere configurable: every one of
 * them is a row-level security policy compiled into the database (0001, 0008,
 * 0010), and they are enforced there whatever the application believes. A
 * screen offering toggles would be describing a permissions system that does
 * not exist, and the first person to flip one would find nothing had changed.
 *
 * The two account roles ARE changeable — on the Users page, one person at a
 * time — because `profiles.role` is a column. What is fixed is what each role
 * means.
 *
 * Kept beside the policies deliberately: a permissions table that drifts from
 * the rules actually in force is worse than no table at all, so the honest
 * version of this page is a description that someone updates in the same
 * commit as the migration.
 */

type Ability = {
  what: string;
  admin: boolean;
  verifier: boolean;
  bank: boolean;
  org: boolean;
  donor: boolean;
};

const ABILITIES: Ability[] = [
  { what: "See every donor on file", admin: true, verifier: true, bank: false, org: false, donor: false },
  { what: "See donors at their own camps", admin: true, verifier: true, bank: true, org: true, donor: false },
  { what: "See their own record only", admin: true, verifier: true, bank: true, org: true, donor: true },
  { what: "Check donors in and correct details at the desk", admin: true, verifier: true, bank: true, org: false, donor: false },
  { what: "Record screening and donation outcomes", admin: true, verifier: true, bank: true, org: false, donor: false },
  { what: "Add a walk-in donor", admin: true, verifier: true, bank: true, org: false, donor: false },
  { what: "Approve and withdraw certificates", admin: true, verifier: false, bank: true, org: false, donor: false },
  { what: "Create, edit and delete camps", admin: true, verifier: false, bank: false, org: false, donor: false },
  { what: "Attach partners to a camp", admin: true, verifier: false, bank: false, org: false, donor: false },
  { what: "Invite colleagues to their own body", admin: true, verifier: false, bank: true, org: true, donor: false },
  { what: "Change somebody's account role", admin: true, verifier: false, bank: false, org: false, donor: false },
  { what: "Read the audit log", admin: true, verifier: false, bank: false, org: false, donor: false },
  { what: "Edit email templates", admin: true, verifier: false, bank: false, org: false, donor: false },
  { what: "View the site as another person", admin: true, verifier: false, bank: false, org: false, donor: false },
];

const COLUMNS = [
  { key: "admin" as const, label: "Admin", icon: ShieldCheck },
  { key: "verifier" as const, label: "Verifier", icon: ClipboardCheck },
  { key: "bank" as const, label: "Blood bank", icon: Droplet },
  { key: "org" as const, label: "Organisation", icon: Building2 },
  { key: "donor" as const, label: "Donor", icon: UserRound },
];

function Yes({ on }: { on: boolean }) {
  return on ? (
    <Check className="mx-auto size-4 text-primary" strokeWidth={2.4} aria-label="Yes" />
  ) : (
    <Minus className="mx-auto size-4 text-muted-foreground/40" strokeWidth={2} aria-label="No" />
  );
}

export default async function RolesPage() {
  const [c, deleteScope] = await Promise.all([getRoleCounts(), getDeleteScope()]);

  return (
    <>
      <PageHeader
        title="Roles"
        subtitle="Who can do what, and how many people hold each role. Reference only — the rules themselves live in the database."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            icon: ShieldCheck,
            label: "Administrators",
            value: c.admin,
            note: "Full access to the console",
            href: "/admin/users?role=admin",
          },
          {
            icon: ClipboardCheck,
            label: "Verifiers",
            value: c.verifier,
            note: "Desk staff on camp day",
            href: "/admin/users?role=verifier",
          },
          {
            icon: UserRound,
            label: "Donors",
            value: c.donor,
            note: "Accounts with no console access",
            href: "/admin/users?role=donor",
          },
          {
            icon: Droplet,
            label: "Blood banks",
            value: c.bloodBanks,
            note: "Bodies that receive units",
            href: "/admin/partners/blood-banks",
          },
          {
            icon: Building2,
            label: "Organisations",
            value: c.organisations,
            note: "Bodies that mobilise donors",
            href: "/admin/partners/organisations",
          },
        ].map((s) => (
          <Panel key={s.label}>
            <Link href={s.href} className="block px-5 py-4">
              <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <s.icon className="size-3.5" strokeWidth={2} aria-hidden />
                {s.label}
              </span>
              <span
                className="font-display mt-1 block text-3xl font-bold tracking-tight"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.value}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{s.note}</span>
            </Link>
          </Panel>
        ))}
      </div>

      <Panel className="overflow-hidden">
        <div className="border-b border-app-line-soft px-5 py-4">
          <h2 className="text-sm font-semibold">What each role can do</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Blood bank and organisation abilities apply only to the camps that
            body is attached to — never to the register as a whole.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-app-line-soft">
                <th className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Ability
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
                  >
                    <span className="flex flex-col items-center gap-1">
                      <col.icon className="size-3.5" strokeWidth={2} aria-hidden />
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABILITIES.map((a) => (
                <tr key={a.what} className="border-b border-app-line-soft last:border-b-0">
                  <td className="px-5 py-3">{a.what}</td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-center">
                      <Yes on={a[col.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Inside a partner</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A second, smaller role that only decides who may manage the member
            list.
          </p>
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 border-b border-app-line-soft pb-3">
              <div>
                <dt className="text-sm font-medium">Owner</dt>
                <dd className="text-xs text-muted-foreground">
                  Everything a member can do, plus adding and removing
                  colleagues without an administrator.
                </dd>
              </div>
              <span className="font-display shrink-0 text-lg font-bold tabular-nums">
                {c.partnerOwner}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <dt className="text-sm font-medium">Member</dt>
                <dd className="text-xs text-muted-foreground">
                  The body&rsquo;s own work, and nothing about who else has
                  access.
                </dd>
              </div>
              <span className="font-display shrink-0 text-lg font-bold tabular-nums">
                {c.partnerMember}
              </span>
            </div>
          </dl>
          {c.unclaimedInvites > 0 && (
            <p className="mt-4 rounded-lg border border-app-line-soft bg-muted/40 p-3 text-xs text-muted-foreground">
              {c.unclaimedInvites} invited{" "}
              {c.unclaimedInvites === 1 ? "address has" : "addresses have"} never
              signed in. They hold no access until they do.
            </p>
          )}
        </Panel>

        {/* The one control on the page, and it earns being one: unlike every
            rule above, this is a stored value the policies read rather than a
            policy itself. Placed beside the explanation of why nothing else is
            adjustable, so the exception is stated where the rule is. */}
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Who may delete records</h2>
          <p className="mt-2 mb-4 text-sm leading-relaxed text-muted-foreground">
            Deleting is the one thing on this page that can be moved, because it
            is the one thing stored as a setting. Every delete is recorded in
            the audit log with the name of whoever did it, whichever option is
            chosen here.
          </p>
          <DeleteScopeControl scope={deleteScope} />
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Why the rest is read-only</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            None of the rules in the table above are settings. Each one is a row-level
            security policy compiled into the database, so it holds whatever the
            application believes — a partner session physically cannot read a
            donor from a camp they are not attached to, even through a
            hand-written request.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Toggles here would describe a permissions system that does not
            exist, and the first person to flip one would find nothing had
            changed. What <em>is</em> changeable is who holds which account
            role.
          </p>
          <Link
            href="/admin/users"
            className="press mt-4 inline-flex h-9 items-center rounded-lg border border-app-line px-3.5 text-sm font-medium"
          >
            Manage people on Users →
          </Link>
        </Panel>
      </div>
    </>
  );
}
