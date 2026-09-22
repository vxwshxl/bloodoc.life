import type { Metadata } from "next";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { requirePartner } from "@/lib/auth/dal";
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
  const { memberships } = await requirePartner();

  const title =
    memberships.length === 1
      ? (memberships[0].partner.short_name ?? memberships[0].partner.name)
      : "Partner panel";

  return (
    <ConsoleShell nav={NAV} title={title} signOutAction={signOut}>
      {children}
    </ConsoleShell>
  );
}
