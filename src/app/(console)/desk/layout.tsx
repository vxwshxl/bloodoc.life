import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { RAIL_COOKIE } from "@/lib/shell-cookies";
import type { NavIndexItem } from "@/components/shell/nav-index";
import { requireVerifier } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { Live } from "@/components/shell/live";

export const metadata: Metadata = {
  title: { default: "Desk", template: "%s · BlooDoc Desk" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/desk", label: "Roster", icon: "registrations", exact: true },
  { href: "/desk/roster", label: "All registrations", icon: "applications" },
];

const NAV_INDEX: NavIndexItem[] = NAV.map((i) => ({
  href: i.href,
  label: i.label,
  exact: i.exact,
}));

/**
 * The desk console.
 *
 * Deliberately two entries. A verifier's whole job on camp morning is one
 * screen — find the person in front of them and record what happened — and a
 * nav offering eight destinations to somebody holding a clipboard is eight
 * chances to end up somewhere they cannot get back from.
 *
 * No assistant panel here either: the desk is used standing up, in a queue,
 * and a chat box is not what that moment needs.
 */
export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireVerifier();
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "1";

  return (
    <ConsoleShell
      nav={NAV}
      navIndex={NAV_INDEX}
      title="BlooDoc Desk"
      signOutAction={signOut}
      accountName={profile.full_name}
      accountEmail={profile.email}
      accountRole={profile.role === "admin" ? "Admin at the desk" : "Verifier"}
      defaultCollapsed={collapsed}
      banner={<ViewAsBanner />}
    >
      {/* Live from here down: the desk only ever shows a roster. It refreshes the
          route rather than patching rows, so every page underneath keeps
          its server-side filtering and pagination and simply redraws. */}
      <Live tables={["registrations", "donors", "camps"]} />
      {children}
    </ConsoleShell>
  );
}
