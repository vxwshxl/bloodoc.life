/**
 * Dates, in the one format this site uses.
 *
 * Asia/Kolkata is pinned rather than left to the runtime. The server renders in
 * UTC and the browser renders in the visitor's zone, so an un-pinned format
 * produces a different string on each side of hydration — and for a camp that
 * starts at 9am, "starts_at" in UTC is the evening before.
 */
const TZ = "Asia/Kolkata";

export function formatCampDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatCampDateShort(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string | null): string {
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TZ,
    }).format(new Date(iso));
  return endIso ? `${time(startIso)} – ${time(endIso)}` : time(startIso);
}

export function formatDateTime(iso: string): string {
  return `${formatCampDateShort(iso)}, ${new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(new Date(iso))}`;
}

/** The three parts the hero's date block stacks. */
export function campDateParts(iso: string) {
  const d = new Date(iso);
  const part = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-IN", { ...opt, timeZone: TZ }).format(d);
  return {
    day: part({ day: "2-digit" }),
    month: part({ month: "short" }).toUpperCase(),
    year: part({ year: "numeric" }),
    weekday: part({ weekday: "long" }),
  };
}

/** "in 12 days" / "tomorrow" / "today" — the urgency line on the hero card. */
export function countdownLabel(iso: string): string {
  const startOfDay = (d: Date) => {
    const s = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
    s.setHours(0, 0, 0, 0);
    return s;
  };
  const days = Math.round(
    (startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
  if (days < 0) return "under way";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 31) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months === 1 ? "in a month" : `in ${months} months`;
}
