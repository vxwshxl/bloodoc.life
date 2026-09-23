import { cn } from "@/lib/utils";

/**
 * One place that maps a status word to a colour and a label.
 *
 * Before this, eight files each carried their own `STATUS_TONE` map. They had
 * drifted: "cancelled" was grey in one table and destructive in another, and a
 * certificate's "pending" and a registration's "registered" — the same idea,
 * "nothing has happened yet" — were different colours on adjacent pages.
 *
 * The colour language, deliberately narrow:
 *   primary     — the good outcome (donated, approved, published)
 *   destructive — something a person has to act on (deferred, withdrawn)
 *   muted       — neutral, waiting, or over (registered, cancelled, closed)
 *
 * No green. This app has one accent and it is the crimson that means blood;
 * introducing a second semantic hue for "success" would put two unrelated
 * colour systems on the same screen.
 */

export type Tone = "primary" | "destructive" | "muted" | "soft";

/** The pill/chip classes for a tone. Exported so a control that *is* the
 * status — a select trigger tinted by its own value — wears the same colour
 * as the pill that reports it elsewhere. */
export const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/12 text-primary",
  destructive: "bg-destructive/12 text-destructive",
  // A step between neutral and the accent, for the middle of a progression.
  soft: "bg-muted text-foreground",
  muted: "bg-muted text-muted-foreground",
};

const SEMANTIC: Record<string, { label: string; tone: Tone }> = {
  // registrations
  registered: { label: "Registered", tone: "muted" },
  screened: { label: "Screened", tone: "soft" },
  donated: { label: "Donated", tone: "primary" },
  deferred: { label: "Deferred", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "muted" },
  // certificates
  pending: { label: "Pending", tone: "muted" },
  approved: { label: "Approved", tone: "primary" },
  revoked: { label: "Withdrawn", tone: "destructive" },
  // camps
  draft: { label: "Draft", tone: "muted" },
  published: { label: "Published", tone: "primary" },
  closed: { label: "Closed", tone: "muted" },
  // accounts
  admin: { label: "Administrator", tone: "primary" },
  verifier: { label: "Verifier", tone: "soft" },
  donor: { label: "Donor", tone: "muted" },
};

export function statusMeta(status: string): { label: string; tone: Tone } {
  return SEMANTIC[status.toLowerCase()] ?? { label: status, tone: "muted" };
}

export function StatusPill({
  status,
  label,
  tone,
  /**
   * How many rows are in this state. Set only where the pill is a tally
   * rather than one row's own state — a camp card summarising its roster.
   * The number leads, because "12 donated" is read as a quantity and
   * "donated 12" is not.
   */
  count,
  className,
}: {
  status?: string;
  label?: string;
  tone?: Tone;
  count?: number;
  className?: string;
}) {
  const meta = status ? statusMeta(status) : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone ?? meta?.tone ?? "muted"],
        className,
      )}
    >
      {count != null && <span className="mr-1 font-bold tabular-nums">{count}</span>}
      {label ?? meta?.label ?? status}
    </span>
  );
}

/**
 * The same semantics as a CSS colour, for chart marks.
 *
 * A bar cannot wear a Tailwind class — it needs a value for `background` — but
 * it must not disagree with the pill beside it about what "deferred" looks
 * like. One map, two renderings.
 */
export function statusChartColor(status: string): string {
  switch (statusMeta(status).tone) {
    case "primary":
      return "var(--primary)";
    case "destructive":
      return "var(--destructive)";
    case "soft":
      return "color-mix(in oklch, var(--primary) 55%, transparent)";
    default:
      return "color-mix(in oklch, var(--muted-foreground) 40%, transparent)";
  }
}
