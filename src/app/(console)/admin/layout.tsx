import type { Metadata } from "next";
import { ConsoleShell, type NavItem } from "@/components/shell/console-shell";
import { requireAdmin } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: { default: "Console", template: "%s · BlooDoc Console" },
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", exact: true },
  { href: "/admin/camps", label: "Camps", icon: "camps" },
  { href: "/admin/registrations", label: "Registrations", icon: "registrations" },
  { href: "/admin/donors", label: "Donors", icon: "donors" },
  {
    href: "/admin/partners",
    label: "Partners",
    icon: "partners",
    // The two kinds are split out because they are not interchangeable: a
    // blood bank may record a donation and an organisation may not, and an
    // admin looking for "who receives our units" should not have to read a
    // badge on every row of a mixed list to find them.
    children: [
      { href: "/admin/partners/blood-banks", label: "Blood banks" },
      { href: "/admin/partners/organisations", label: "Organisations" },
    ],
  },
  { href: "/admin/email", label: "Email", icon: "email" },
  { href: "/admin/assistant", label: "Assistant", icon: "assistant" },
  { href: "/admin/audit", label: "Audit", icon: "audit" },
];

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // Gate the whole console in one place. Every page underneath inherits it, so
  // a new route cannot be added without the check — which is how a console
  // eventually leaks a page.
  await requireAdmin();

  return (
    <ConsoleShell nav={NAV} title="BlooDoc Console" signOutAction={signOut}>
      {children}
    </ConsoleShell>
  );
}
