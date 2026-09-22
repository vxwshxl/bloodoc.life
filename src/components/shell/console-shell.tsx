"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Droplet,
  LayoutDashboard,
  ChevronDown,
  LogOut,
  Mail,
  Menu,
  ScrollText,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { useMediaQuery } from "./use-media-query";
import { cn } from "@/lib/utils";

/**
 * The nav's icons, resolved here rather than passed in.
 *
 * A layout is a Server Component and this is a Client Component, so anything
 * crossing between them has to be serializable. An icon used to survive that
 * trip because lucide-react shipped its icons as client modules, which made an
 * imported icon a client *reference* rather than a function. As of lucide-react
 * 1.x only `Icon`, `context` and `DynamicIcon` carry "use client", so the icon
 * arrives as a bare forwardRef object and React refuses it:
 *
 *   Functions cannot be passed directly to Client Components…
 *     {$$typeof: ..., render: function LayoutDashboard}
 *
 * Passing a string key instead means the boundary only ever carries data, which
 * is true regardless of how the icon library decides to package itself next.
 */
const NAV_ICONS = {
  overview: LayoutDashboard,
  camps: CalendarDays,
  registrations: Droplet,
  donors: Users,
  partners: Building2,
  email: Mail,
  assistant: Sparkles,
  certificates: BadgeCheck,
  audit: ScrollText,
} as const;

export type NavIcon = keyof typeof NAV_ICONS;

export type NavChild = { href: string; label: string };

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /**
   * A sub-list, revealed while the section is open.
   *
   * Open is derived from the URL, not held in state: a sidebar that collapses
   * the section you are currently inside — which is what a `useState` default
   * does on every navigation — loses your place on every click.
   */
  children?: NavChild[];
  /** Only highlight on an exact match — for an index route that prefixes others. */
  exact?: boolean;
};

/**
 * The signed-in shell: a sidebar that is a floating panel on a laptop and a
 * drawer on a phone.
 *
 * The desktop rail is `sticky` inside a grid rather than `fixed`, so the main
 * column is laid out beside it by the grid and never has to be padded by hand
 * to a width the sidebar happens to be.
 */
export function ConsoleShell({
  nav,
  title,
  signOutAction,
  children,
}: {
  nav: NavItem[];
  /** Console name — the drawer's accessible name and the mobile bar's label. */
  title: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // `true` on the server: the console is a desktop tool first, and guessing
  // "phone" would render every first paint as a drawer and then reflow.
  const isDesktop = useMediaQuery("(min-width: 64rem)", true);

  // Two things only the open drawer needs: the page behind it must not scroll
  // under the reader's thumb, and Escape must shut it.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="app-shell relative grid min-h-dvh flex-1 gap-0 lg:p-3">
      {/* The ambient ground. Fixed rather than absolute so the blooms cover the
          viewport and not the document — they should not stretch to the length
          of a 900-row donor roster — and inert so they never take a click. */}
      <div aria-hidden className="bg-app-ground fixed inset-0 -z-10 print:hidden" />

      <aside
        id="console-nav"
        aria-label={`${title} navigation`}
        // Off-screen is not the same as gone: without this the whole nav stays
        // in the tab order behind the closed drawer, and the first Tab on a
        // phone lands somewhere invisible.
        inert={!isDesktop && !open}
        className={cn(
          "z-50 flex flex-col gap-4 border border-app-line-soft bg-sidebar p-4 text-sidebar-foreground shadow-card print:hidden",
          "lg:sticky lg:top-3 lg:h-[calc(100dvh-1.5rem)] lg:translate-x-0 lg:rounded-2xl",
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[17rem] max-lg:rounded-r-2xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-drawer motion-reduce:max-lg:transition-none",
          open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
        )}
        // One handler for every link in the nav rather than an effect on
        // `pathname`: a click that landed on a link has navigated, so the
        // drawer's work is done. Closing it from an effect instead means
        // setting state in response to a render, which is a cascading render
        // for something the click already told us.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
      >
        <div className="flex items-center gap-2 border-b border-app-line-soft px-1 pb-4">
          <Link href="/" aria-label="BlooDoc home" className="flex min-w-0 items-center rounded-md">
            <Wordmark subtle />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent lg:hidden"
          >
            <X className="size-4.5" strokeWidth={1.9} />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = isActive(item);
            const Icon = NAV_ICONS[item.icon];
            // A section stands open whenever the current page is inside it, so
            // the child you navigated to is still visible when the page lands.
            const sectionOpen =
              !!item.children &&
              (active || item.children.some((c) => pathname.startsWith(c.href)));

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // A row-shaped control presses with a colour tint rather
                    // than `.press`: scaling a full-width row shears it against
                    // its neighbours.
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={1.9} />
                  {item.label}
                  {item.children && (
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "ml-auto size-3.5 transition-transform duration-200",
                        sectionOpen ? "rotate-180" : "rotate-0",
                      )}
                      strokeWidth={2}
                    />
                  )}
                </Link>

                {item.children && sectionOpen && (
                  <ul className="mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-app-line-soft pl-3 ml-5">
                    {item.children.map((child) => {
                      const childActive =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={childActive ? "page" : undefined}
                            className={cn(
                              "block rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                              childActive
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <form action={signOutAction} className="border-t border-app-line-soft pt-3">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4.5" strokeWidth={1.9} />
            Sign out
          </button>
        </form>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--scrim)] lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-app-line-soft bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-controls="console-nav"
            aria-expanded={open}
            className="press flex size-9 items-center justify-center rounded-lg border border-app-line text-muted-foreground"
          >
            <Menu className="size-4.5" strokeWidth={1.9} />
          </button>
          <span className="font-display text-sm font-semibold tracking-tight">{title}</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
