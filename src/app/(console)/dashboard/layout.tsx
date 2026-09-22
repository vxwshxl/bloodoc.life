import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { RAIL_COOKIE } from "@/lib/shell-cookies";
import type { NavIndexItem } from "@/components/shell/nav-index";
import { getEffectiveProfile } from "@/lib/auth/impersonation";
import { signOut } from "@/lib/auth/actions";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { Assistant } from "@/components/admin/assistant";
import { isAssistantConfigured } from "@/lib/ai/chat";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · BlooDoc" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", exact: true },
  { href: "/dashboard/applications", label: "Applications", icon: "applications" },
  { href: "/dashboard/certificates", label: "Certificates", icon: "certificates" },
  { href: "/dashboard/profile", label: "Profile", icon: "profile" },
];

const NAV_INDEX: NavIndexItem[] = NAV.map((i) => ({
  href: i.href,
  label: i.label,
  exact: i.exact,
}));

/**
 * The donor's console.
 *
 * Donors used to get `/me` — a single marketing-shell page with everything on
 * it — while staff got a console. That split meant two navigation systems, two
 * shells and two places to add a feature, and it left a donor with no obvious
 * home for their certificates or their profile. They are the same kind of user
 * as everybody else here: somebody with records to look at.
 *
 * A donor who is also a partner member or an administrator is sent to the
 * wider console instead, so nobody is stuck in the narrowest view they qualify
 * for.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const e = await getEffectiveProfile();
  if (!e) redirect("/signin");

  // Not while viewing as somebody: an administrator rehearsing a donor's view
  // is the whole point of landing here, so only a *real* wider role redirects.
  if (!e.viewingAs) {
    if (e.profile.role === "admin") redirect("/admin");
    if (e.profile.role === "verifier") redirect("/desk");
    if (e.memberships.length > 0) redirect("/partner");
  }

  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "1";

  return (
    <ConsoleShell
      nav={NAV}
      navIndex={NAV_INDEX}
      title="BlooDoc"
      assistant={<Assistant configured={isAssistantConfigured()} audience="donor" />}
      signOutAction={signOut}
      accountName={e.profile.full_name}
      accountEmail={e.profile.email}
      accountRole="Donor"
      defaultCollapsed={collapsed}
      banner={<ViewAsBanner />}
    >
      {children}
    </ConsoleShell>
  );
}
