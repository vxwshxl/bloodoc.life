import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarDays,
  Droplet,
  LayoutDashboard,
  Mail,
  Search,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Design size of every panel mock. Matches the console's own 16rem rail. */
export const MOCK_W = 1280;
export const MOCK_H = 800;

const NAV: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: CalendarDays, label: "Camps" },
  { icon: Users, label: "Donors" },
  { icon: Droplet, label: "Registrations" },
  { icon: Mail, label: "Email" },
  { icon: Sparkles, label: "Assistant" },
  { icon: Settings, label: "Settings" },
];

/**
 * The console shell, rebuilt at mock scale.
 *
 * It reads the product's own `bg-sidebar` / `bg-card` / `border-border` tokens
 * rather than copies of their values, which is what lets the mock follow the
 * theme with the rest of the page — and means it cannot drift the day the
 * palette changes.
 */
export function ConsoleMock({
  active,
  title,
  subtitle,
  children,
}: {
  active: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid h-full grid-cols-[16rem_1fr] bg-background">
      <aside className="flex flex-col border-r border-app-line-soft bg-sidebar p-4 text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Droplet className="size-4.5" strokeWidth={2.4} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-semibold tracking-tight">BlooDoc</span>
            <span className="mt-1 text-[11px] text-muted-foreground">Console</span>
          </span>
        </div>

        <nav className="mt-4 flex flex-col gap-0.5">
          {NAV.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                label === active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="size-4.5" strokeWidth={1.9} />
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-4 border-b border-app-line-soft px-6 py-4">
          <div className="flex h-9 w-72 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
            <Search className="size-4" strokeWidth={1.9} />
            Search donors, camps…
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="relative flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <Bell className="size-4.5" strokeWidth={1.9} />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
            </span>
            <span className="size-9 rounded-full bg-muted" />
          </div>
        </header>

        <div className="min-w-0 flex-1 overflow-hidden px-6 py-5">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A figure tile. `delay` staggers the bar growth when several sit in a row. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-app-line-soft p-5 shadow-card",
        tone === "primary" ? "bg-primary/8" : "bg-card",
      )}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 font-display text-3xl font-bold tracking-tight",
          tone === "primary" && "text-primary",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** The blood-group chip used across the console mocks. */
export function GroupChip({ group }: { group: string }) {
  return (
    <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-md bg-primary/12 px-1.5 text-xs font-bold text-primary">
      {group}
    </span>
  );
}
