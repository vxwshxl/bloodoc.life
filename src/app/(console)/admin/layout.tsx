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
  { href: "/admin/partners", label: "Partners", icon: "partners" },
  { href: "/admin/email", label: "Email", icon: "email" },
  { href: "/admin/assistant", label: "Assistant", icon: "assistant" },
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
