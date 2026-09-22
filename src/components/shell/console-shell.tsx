"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Droplet,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Sparkles,
  UserRound,
  Users,
  IdCard,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumbs } from "./breadcrumbs";
import { Clock } from "./clock";
import { CommandPalette } from "./command-palette";
import { useMediaQuery } from "./use-media-query";
import type { NavIndexItem } from "./nav-index";
import { RAIL_COOKIE } from "@/lib/shell-cookies";
import { cn } from "@/lib/utils";

/**
 * The console shell: a sidebar that collapses to an icon rail, and a topbar
 * carrying where-you-are, the time, search and the account.
 *
 * The rail preference is a cookie rather than component state so the first
 * paint is already the right width — held in React it would render expanded,
 * hydrate, and then snap narrow on every single navigation.
 */


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
 * stays true regardless of how the icon library packages itself next.
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
  users: UserRound,
  applications: ClipboardList,
  profile: IdCard,
} as const;

export type NavIcon = keyof typeof NAV_ICONS;

export type NavChild = { href: string; label: string };

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Only highlight on an exact match — for an index route that prefixes others. */
  exact?: boolean;
  /**
   * A sub-list, revealed while the section is open.
   *
   * Open is derived from the URL, not held in state: a sidebar that collapses
   * the section you are currently inside — which is what a `useState` default
   * does on every navigation — loses your place on every click.
   */
  children?: NavChild[];
};

export function ConsoleShell({
  nav,
  navIndex,
  title,
  /**
   * The assistant, when the console has one. It sits with the mark rather than
   * in the nav on purpose: it is not another section of the console, it is a
   * way to work the whole of it.
   */
  assistantHref,
  assistant,
  signOutAction,
  accountName,
  accountEmail,
  accountRole,
  defaultCollapsed = false,
  children,
}: {
  nav: NavItem[];
  /** Flat, icon-free list for the breadcrumbs and the palette. */
  navIndex: NavIndexItem[];
  title: string;
  assistantHref?: string;
  /**
   * The assistant, already rendered by the layout. Passed as a node rather
   * than imported here because it needs server-side configuration state, and
   * this file is a Client Component.
   */
  assistant?: React.ReactNode;
  signOutAction: () => Promise<void>;
  accountName?: string | null;
  accountEmail?: string | null;
  accountRole?: string | null;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // `true` on the server: the console is a desktop tool first, and guessing
  // "phone" would render every first paint as a drawer and then reflow.
  const isDesktop = useMediaQuery("(min-width: 64rem)", true);
  const drawerOpen = open && !isDesktop;

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // A year, because the preference is about how this person likes to work,
    // not about this session.
    document.cookie = `${RAIL_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Two things only the open drawer needs: the page behind it must not scroll
  // under the reader's thumb, and Escape must shut it.
  useEffect(() => {
    if (!drawerOpen) return;
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
  }, [drawerOpen]);

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const rootHref = nav[0]?.href ?? "/admin";
  const initials =
    (accountName ?? accountEmail ?? "?")
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div
      className="app-shell relative grid min-h-dvh flex-1 gap-0 lg:p-3"
      data-rail={collapsed ? "collapsed" : "expanded"}
    >
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
        // drawer's work is done.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a[href]")) setOpen(false);
        }}
      >
        <div
          data-rail-compact
          className="flex items-center gap-2 border-b border-app-line-soft px-1 pb-4"
        >
          <Link href="/" aria-label="BlooDoc home" className="flex min-w-0 items-center rounded-md">
            <Wordmark subtle />
          </Link>

          {/* A panel, not a page. The assistant is a way to work the console,
              not another section of it — sending someone to a full-screen route
              means leaving the roster they were reading in order to ask a
              question about it. It falls back to the route when no panel was
              passed, so the page still works on its own. */}
          {assistant ? (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              title="Assistant"
              aria-label="Open the assistant"
              aria-expanded={assistantOpen}
              data-rail-hide
              className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 transition-colors hover:bg-violet-500/25"
            >
              <Sparkles className="size-4.5" strokeWidth={1.9} />
            </button>
          ) : (
            assistantHref && (
              <Link
                href={assistantHref}
                title="Assistant"
                aria-label="Assistant"
                data-rail-hide
                className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 transition-colors hover:bg-violet-500/25"
              >
                <Sparkles className="size-4.5" strokeWidth={1.9} />
              </Link>
            )
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="press ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent lg:hidden"
          >
            <X className="size-4.5" strokeWidth={1.9} />
          </button>
        </div>

        <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
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
                  data-rail-compact
                  title={item.label}
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
                  <Icon className="size-4.5 shrink-0" strokeWidth={1.9} />
                  <span data-rail-hide className="min-w-0 flex-1 truncate">
                    {item.label}
                  </span>
                  {item.children && (
                    <ChevronDown
                      aria-hidden
                      data-rail-hide
                      className={cn(
                        "size-3.5 shrink-0 transition-transform duration-200",
                        sectionOpen ? "rotate-180" : "rotate-0",
                      )}
                      strokeWidth={2}
                    />
                  )}
                </Link>

                {item.children && sectionOpen && (
                  <ul
                    data-rail-hide
                    className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-app-line-soft pl-3"
                  >
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
            data-rail-compact
            title="Sign out"
            className="press flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4.5 shrink-0" strokeWidth={1.9} />
            <span data-rail-hide>Sign out</span>
          </button>
        </form>
      </aside>

      {/* Backdrop. A real button so Escape is not the only way out for someone
          who opened the drawer by accident. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-(--scrim) backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-col">
        <header className="z-30 flex min-h-14 items-center gap-3 px-4 py-2 max-lg:sticky max-lg:top-0 max-lg:border-b max-lg:border-app-line-soft max-lg:bg-background/85 max-lg:backdrop-blur lg:px-2 print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            aria-controls="console-nav"
            aria-expanded={open}
            className="press flex size-9 shrink-0 items-center justify-center rounded-lg border border-app-line bg-card text-foreground shadow-xs lg:hidden"
          >
            <Menu className="size-4.5" strokeWidth={1.9} />
          </button>

          {/* The desktop counterpart to the hamburger. It lives in the topbar
              rather than on the sidebar so it stays in one place whether the
              sidebar is a full column or a narrow rail — a control that moves
              when you use it is one you have to hunt for twice. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="press hidden size-9 shrink-0 items-center justify-center rounded-lg border border-app-line bg-card text-muted-foreground shadow-xs transition-colors hover:text-foreground lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4.5" strokeWidth={1.9} />
            ) : (
              <PanelLeftClose className="size-4.5" strokeWidth={1.9} />
            )}
          </button>

          {/* Desktop-only. On a phone the reader arrived here by tapping one
              item in a drawer they just closed, and the trail tells them
              nothing the H1 underneath does not. */}
          <Breadcrumbs
            brand={title}
            rootHref={rootHref}
            index={navIndex}
            className="hidden min-w-0 shrink lg:flex"
          />

          {/* `mr-auto` rather than `flex-1`: the clock takes the slack the
              breadcrumbs leave below lg without becoming the thing that gives
              way when the topbar runs out of room. */}
          <Clock className="mr-auto shrink-0 lg:mr-0" />

          <CommandPalette index={navIndex} />

          {/* The account, as a menu rather than a label.
              It was a static avatar and name, which is a thing you look at —
              and the first place anybody hunts for "my profile" and "sign
              out". A menu costs the same room and answers both. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Your account"
                className="press flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary"
                >
                  {initials}
                </span>
                <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
                  <span className="truncate text-xs font-semibold">
                    {accountName ?? accountEmail ?? "Signed in"}
                  </span>
                  {accountRole && (
                    <span className="truncate text-[0.6875rem] text-muted-foreground capitalize">
                      {accountRole}
                    </span>
                  )}
                </span>
                <ChevronDown
                  aria-hidden
                  className="hidden size-3.5 shrink-0 text-muted-foreground sm:block"
                  strokeWidth={2}
                />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {accountName ?? "Signed in"}
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {accountEmail}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/me/profile" className="gap-2">
                  <UserRound className="size-4" strokeWidth={1.9} aria-hidden />
                  Your profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/me" className="gap-2">
                  <IdCard className="size-4" strokeWidth={1.9} aria-hidden />
                  Your donor record
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                {/* A form, not a link: signing out is a state change and must
                    not be something a prefetch or a crawler can trigger. */}
                <form action={signOutAction} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="size-4" strokeWidth={1.9} aria-hidden />
                    Sign out
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-4 pb-10 lg:px-2 lg:pt-3">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/*
        The assistant drawer.

        A side panel on a laptop, where there is room to read a roster and ask
        about it at the same time; full screen below that, because a 26rem
        column on a 390px phone is the whole screen anyway and pretending
        otherwise just adds a backdrop nobody can tap.

        Always mounted, hidden with `translate-x-full`, so the transcript
        survives closing the panel — unmounting it would throw away the
        conversation every time somebody looked something up.
      */}
      {assistant && (
        <>
          {assistantOpen && (
            <button
              type="button"
              aria-label="Close the assistant"
              onClick={() => setAssistantOpen(false)}
              className="fixed inset-0 z-50 hidden bg-(--scrim) backdrop-blur-[2px] lg:block"
            />
          )}
          <aside
            aria-label="Assistant"
            inert={!assistantOpen}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-app-line-soft bg-background shadow-card transition-transform duration-200 ease-drawer motion-reduce:transition-none lg:max-w-[28rem]",
              assistantOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-app-line-soft px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-violet-600" strokeWidth={2} aria-hidden />
                Assistant
              </span>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                aria-label="Close the assistant"
                className="press flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{assistant}</div>
          </aside>
        </>
      )}
    </div>
  );
}
