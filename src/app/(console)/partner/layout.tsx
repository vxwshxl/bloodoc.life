import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { RAIL_COOKIE } from "@/lib/shell-cookies";
import type { NavIndexItem } from "@/components/shell/nav-index";
import { redirect } from "next/navigation";
import { getEffectiveProfile } from "@/lib/auth/impersonation";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: { default: "Partner", template: "%s · BlooDoc Partner" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/partner", label: "Overview", icon: "overview", exact: true },
  { href: "/partner/registrations", label: "Roster", icon: "registrations" },
  { href: "/partner/certificates", label: "Certificates", icon: "certificates" },
  { href: "/partner/camps", label: "Camps", icon: "camps" },
];

const NAV_INDEX: NavIndexItem[] = NAV.map((item) => ({
  href: item.href,
  label: item.label,
  exact: item.exact,
}));

/**
 * The partner panel.
 *
 * Gated in one place, exactly like the admin console, and for the same reason:
 * a page added under this folder cannot be added without the check.
 *
 * The shell is titled with the body's own name rather than "BlooDoc" — someone
 * who coordinates for two organisations needs to know at a glance which one
 * they are looking at, and the numbers on the overview differ between them.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  // Resolved through the effective profile rather than `requirePartner`, so an
  // administrator viewing as a coordinator lands in that body's panel and sees
  // exactly their camps — which is the whole point of the feature.
  const e = await getEffectiveProfile();
  if (!e) redirect("/signin");
  const { profile, memberships } = e;
  if (memberships.length === 0) redirect(profile.role === "admin" ? "/admin" : "/me");
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "1";

  const title =
    memberships.length === 1
      ? (memberships[0].partner.short_name ?? memberships[0].partner.name)
      : "Partner panel";

  return (
    <ConsoleShell
      nav={NAV}
      navIndex={NAV_INDEX}
      title={title}
      signOutAction={signOut}
      accountName={profile.full_name}
      accountEmail={profile.email}
      accountRole={
        memberships.length === 1
          ? memberships[0].partner.kind === "blood_bank"
            ? "Blood bank"
            : "Organisation"
          : "Partner"
      }
      defaultCollapsed={collapsed}
      banner={<ViewAsBanner />}
    >
      {children}
    </ConsoleShell>
  );
}
