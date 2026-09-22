import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { RAIL_COOKIE } from "@/lib/shell-cookies";
import type { NavIndexItem } from "@/components/shell/nav-index";
import { requireAdmin } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";
import { ViewAsBanner } from "@/components/shell/view-as-banner";
import { Assistant } from "@/components/admin/assistant";
import { Live } from "@/components/shell/live";
import { isAssistantConfigured } from "@/lib/ai/chat";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · BlooDoc Console" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/camps", label: "Camps", icon: "camps" },
  { href: "/admin/registrations", label: "Registrations", icon: "registrations" },
  { href: "/admin/donors", label: "Donors", icon: "donors" },
  { href: "/admin/users", label: "Users", icon: "users", exact: true },
  { href: "/admin/roles", label: "Roles", icon: "roles" },
  {
    href: "/admin/partners",
    label: "Partners",
    icon: "partners",
    // The two kinds are split because they are not interchangeable: a blood
    // bank may record a donation and an organisation may not, and an admin
    // looking for "who receives our units" should not have to read a badge on
    // every row of a mixed list to find them.
    children: [
      { href: "/admin/partners/blood-banks", label: "Blood banks" },
      { href: "/admin/partners/organisations", label: "Organisations" },
    ],
  },
  { href: "/admin/certificates", label: "Certificates", icon: "certificates" },
  {
    href: "/admin/email",
    label: "Email",
    icon: "email",
    children: [
      { href: "/admin/email", label: "Sent log" },
      { href: "/admin/templates", label: "Templates" },
    ],
  },
  { href: "/admin/audit", label: "Audit", icon: "audit" },
];

/**
 * The flat index behind the breadcrumbs and the command palette.
 *
 * Derived from NAV rather than written a second time: a destination that
 * exists in one list and not the other is exactly the drift that makes a
 * palette untrustworthy.
 */
const NAV_INDEX: NavIndexItem[] = [
  ...NAV.flatMap((item): NavIndexItem[] => [
    { href: item.href, label: item.label, exact: item.exact },
    ...(item.children ?? []).map((c) => ({
      href: c.href,
      label: c.label,
      group: item.label,
    })),
  ]),
  // Not in NAV: the assistant lives beside the mark, not in the nav list, but
  // it is still somewhere you can go and so still belongs in the palette.
  { href: "/admin/assistant", label: "Assistant" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole console in one place. Every page underneath inherits it, so
  // a new route cannot be added without the check — which is how a console
  // eventually leaks a page.
  const profile = await requireAdmin();
  // Read server-side so the first paint is already the right width.
  const collapsed = (await cookies()).get(RAIL_COOKIE)?.value === "1";

  return (
    <ConsoleShell
      nav={NAV}
      navIndex={NAV_INDEX}
      title="BlooDoc Console"
      assistantHref="/admin/assistant"
      assistant={<Assistant configured={isAssistantConfigured()} />}
      signOutAction={signOut}
      accountName={profile.full_name}
      accountEmail={profile.email}
      accountRole={profile.role}
      defaultCollapsed={collapsed}
      banner={<ViewAsBanner />}
    >
      {/* Live from here down: the console sees everything, so it listens for everything. It refreshes the
          route rather than patching rows, so every page underneath keeps
          its server-side filtering and pagination and simply redraws. */}
      <Live tables={["camps", "registrations", "donors", "certificates", "partners", "partner_members", "camp_partners", "profiles", "email_log", "audit_log"]} />
      {children}
    </ConsoleShell>
  );
}
