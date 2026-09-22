"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's one date picker.
 *
 * Same argument as `Dropdown`: a native control cannot be made to match the
 * rest of the console on any platform, and it does not try. Chrome's
 * `datetime-local` panel is a blue system sheet with its own type scale; Safari
 * shows three spinning wheels; Firefox shows something else again. The camp
 * form had one of those sitting directly beneath our own text inputs and select
 * menus, so the one field that decides when a hundred people turn up looked
 * like it belonged to a different application.
 *
 * **The wire format is unchanged and that is not negotiable.** A hidden input
 * carries exactly what `datetime-local` and `date` used to post —
 * `YYYY-MM-DDTHH:mm` and `YYYY-MM-DD`, zoneless — because `istToIso` in
 * `lib/admin/actions.ts` reads that string as +05:30. Anything that emitted a
 * UTC instant here would silently move every camp by five and a half hours.
 *
 * Nothing in this file constructs a `Date` from the stored value and reads
 * fields back off it. The value is parsed as text and formatted as text, so the
 * server's zone during SSR and the browser's zone afterwards can never
 * disagree — which is the bug that makes a date picker show yesterday.
 */

type Mode = "date" | "datetime";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** `2026-09-25T11:00` → its parts, or null for anything malformed. */
function parse(value: string): { y: number; m: number; d: number; hh: number; mm: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const parts = {
    y: Number(y),
    m: Number(m) - 1,
    d: Number(d),
    hh: hh ? Number(hh) : 0,
    mm: mm ? Number(mm) : 0,
  };
  if (parts.m < 0 || parts.m > 11 || parts.d < 1 || parts.d > 31) return null;
  return parts;
}

const pad = (n: number) => String(n).padStart(2, "0");

function serialise(
  p: { y: number; m: number; d: number; hh: number; mm: number },
  mode: Mode,
): string {
  const date = `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
  return mode === "datetime" ? `${date}T${pad(p.hh)}:${pad(p.mm)}` : date;
}

/**
 * How many days September 2026 has, and which weekday it starts on.
 *
 * `Date.UTC` rather than the local constructor: this is arithmetic about a
 * calendar, not about an instant, and doing it in UTC keeps a machine set to
 * UTC-5 from deciding the month starts a day earlier.
 */
function monthGrid(y: number, m: number) {
  const first = new Date(Date.UTC(y, m, 1));
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return { offset: first.getUTCDay(), days };
}

function labelFor(value: string, mode: Mode, placeholder: string): string {
  const p = parse(value);
  if (!p) return placeholder;
  const date = `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}`;
  if (mode === "date") return date;
  const period = p.hh < 12 ? "am" : "pm";
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
  return `${date}, ${h12}:${pad(p.mm)} ${period}`;
}

/** Today, read in IST — the zone every date in this app is stated in. */
function todayInIST(): { y: number; m: number; d: number } {
  // `en-CA` formats as "2026-09-22", which parses without a second thought.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" })
    .format(new Date())
    .split("-")
    .map(Number);
  return { y, m: m - 1, d };
}

export function DatePicker({
  name,
  defaultValue = "",
  mode = "date",
  id,
  required,
  disabled,
  invalid,
  placeholder = mode === "datetime" ? "Pick a date and time" : "Pick a date",
  /** Earliest selectable year. Defaults to a decade back. */
  fromYear,
  /** Latest selectable year. Defaults to five years out. */
  toYear,
  /**
   * Which year an *empty* field opens on. A date of birth that opens on the
   * current year makes every donor scroll back twenty-five years before they
   * can start; one that opens on a plausible birth year is one interaction.
   * Ignored once a value is set — then the calendar opens on that.
   */
  initialYear,
  /** Minutes between options in the time column. */
  minuteStep = 5,
  className,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  mode?: Mode;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  initialYear?: number;
  minuteStep?: number;
  className?: string;
  onChange?: (value: string) => void;
}) {
  const today = useMemo(() => todayInIST(), []);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  /**
   * Which pane the calendar side is showing.
   *
   * A month-and-year chooser has nowhere good to go: a second floating menu
   * inside a popover is a portal within a portal, and on a phone it lands
   * off-screen as often as not. Swapping the pane in place needs no second
   * layer, keeps the panel one size, and is the pattern both phone platforms
   * already use.
   */
  const [pane, setPane] = useState<"day" | "month" | "year">("day");

  const parsed = parse(value);
  // What the calendar is showing, which is not the same as what is selected —
  // paging to December to look at it must not select a day in December.
  const [view, setView] = useState(() => ({
    y: parsed?.y ?? initialYear ?? today.y,
    m: parsed?.m ?? today.m,
  }));

  const years = useMemo(() => {
    const from = fromYear ?? today.y - 10;
    const to = toYear ?? today.y + 5;
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }, [fromYear, toYear, today.y]);

  const { offset, days } = monthGrid(view.y, view.m);
  const activeTime = useRef<HTMLButtonElement>(null);

  // Bring the chosen time into view when the panel opens. A 4pm camp otherwise
  // opens the column at midnight with 192 rows above it. `scrollTop` on the
  // column itself rather than `scrollIntoView`, which also scrolls every
  // ancestor and would move the form behind the popover.
  useEffect(() => {
    if (!open) return;
    const el = activeTime.current;
    if (!el) return;
    const column = el.parentElement;
    if (column) column.scrollTop = el.offsetTop - column.clientHeight / 2 + el.clientHeight / 2;
  }, [open]);

  function commit(next: string) {
    setValue(next);
    onChange?.(next);
  }

  function pickDay(day: number) {
    const next = serialise(
      {
        y: view.y,
        m: view.m,
        d: day,
        // A camp with no time yet opens at 9am rather than at midnight, which
        // is never the answer and is what an unset field would otherwise post.
        hh: parsed?.hh ?? 9,
        mm: parsed?.mm ?? 0,
      },
      mode,
    );
    commit(next);
    // A date-only field is finished the moment a day is chosen. A datetime one
    // is not — closing here would hide the time column before it was used.
    if (mode === "date") setOpen(false);
  }

  function pickTime(hh: number, mm: number) {
    const base = parsed ?? { ...today, hh: 9, mm: 0 };
    commit(serialise({ y: base.y, m: base.m, d: base.d, hh, mm }, mode));
  }

  function shiftMonth(by: number) {
    setView((v) => {
      const m = v.m + by;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m };
    });
  }

  const times = useMemo(() => {
    const out: { hh: number; mm: number; label: string }[] = [];
    for (let hh = 0; hh < 24; hh++) {
      for (let mm = 0; mm < 60; mm += minuteStep) {
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        out.push({ hh, mm, label: `${h12}:${pad(mm)} ${hh < 12 ? "am" : "pm"}` });
      }
    }
    return out;
  }, [minuteStep]);

  return (
    <>
      {/* The only thing the server ever sees.
          No `required` on it: a hidden input is barred from constraint
          validation, so the attribute would be decoration. An empty required
          field is caught by the server action, which already answers "That
          start time is not a valid date" — the trigger is marked
          `aria-required` so a screen reader still says the field is needed. */}
      <input type="hidden" name={name} value={value} />

      <PopoverPrimitive.Root
        open={open}
        // The pane resets here rather than in an effect watching `open`: this
        // is the event that opens it, so there is no render in between where
        // the panel is up and still showing last time's year grid.
        onOpenChange={(next) => {
          if (next) setPane("day");
          setOpen(next);
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id ?? name}
            disabled={disabled}
            data-required={required || undefined}
            data-invalid={invalid || undefined}
            className={cn(
              "press flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base outline-none md:text-sm",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "data-invalid:border-destructive data-invalid:ring-destructive/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          >
            {mode === "datetime" ? (
              <Clock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} aria-hidden />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} aria-hidden />
            )}
            <span className={cn("min-w-0 flex-1 truncate", !parsed && "text-muted-foreground")}>
              {labelFor(value, mode, placeholder)}
            </span>
            {value && (
              // A span, not a nested button: a button inside a button is
              // invalid HTML and the browser hoists it out of the trigger.
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commit("");
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden />
              </span>
            )}
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            className="z-50 flex origin-(--radix-popover-content-transform-origin) gap-0 overflow-hidden rounded-xl border border-app-line-soft bg-popover p-0 text-popover-foreground shadow-raised outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="p-3">
              <div className="mb-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  disabled={pane !== "day"}
                  className="press flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />
                </button>

                {/* The title is the chooser. Tapping it swaps the day grid for
                    months, and again for years — no second menu, no portal
                    inside a portal. */}
                <button
                  type="button"
                  onClick={() =>
                    setPane((p) => (p === "day" ? "month" : p === "month" ? "year" : "day"))
                  }
                  aria-label="Choose month and year"
                  className="press flex h-7 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold transition-colors hover:bg-muted"
                >
                  {pane === "year" ? "Pick a year" : `${MONTHS[view.m]} ${view.y}`}
                  <ChevronDown
                    className={cn("size-3.5 transition-transform", pane !== "day" && "rotate-180")}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </button>

                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  disabled={pane !== "day"}
                  className="press flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

              {pane === "day" && (
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="flex size-9 items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {w}
                  </span>
                ))}
                {/* Leading blanks so the 1st lands under its weekday. */}
                {Array.from({ length: offset }, (_, i) => (
                  <span key={`pad-${i}`} className="size-9" />
                ))}
                {Array.from({ length: days }, (_, i) => {
                  const day = i + 1;
                  const selected =
                    parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === day;
                  const isToday =
                    today.y === view.y && today.m === view.m && today.d === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pickDay(day)}
                      aria-pressed={!!selected}
                      className={cn(
                        "press flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                        selected
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted",
                        // Today is outlined rather than filled, so it never
                        // reads as a selection somebody did not make.
                        !selected && isToday && "font-semibold ring-1 ring-app-line ring-inset",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              )}

              {pane === "month" && (
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setView((v) => ({ ...v, m: i }));
                        setPane("day");
                      }}
                      aria-pressed={view.m === i}
                      className={cn(
                        "press h-11 rounded-lg text-sm transition-colors",
                        view.m === i
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}

              {pane === "year" && (
                <div className="grid max-h-[15.5rem] grid-cols-4 gap-1 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      type="button"
                      // Scrolls the current year into view the first time the
                      // pane is drawn. A date of birth list is a century long.
                      ref={
                        y === view.y
                          ? (el) => {
                              el?.scrollIntoView({ block: "center" });
                            }
                          : undefined
                      }
                      onClick={() => {
                        setView((v) => ({ ...v, y }));
                        setPane("month");
                      }}
                      aria-pressed={view.y === y}
                      className={cn(
                        "press h-10 rounded-lg text-sm tabular-nums transition-colors",
                        view.y === y
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between border-t border-app-line-soft pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setView({ y: today.y, m: today.m });
                    setPane("day");
                    pickDay(today.d);
                  }}
                  className="press rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Today
                </button>
                {mode === "datetime" && (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="press rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>

            {mode === "datetime" && (
              <div
                className="flex max-h-[19rem] w-28 flex-col gap-0.5 overflow-y-auto border-l border-app-line-soft p-2"
              >
                {times.map((t) => {
                  const active = parsed && parsed.hh === t.hh && parsed.mm === t.mm;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      ref={active ? activeTime : undefined}
                      onClick={() => pickTime(t.hh, t.mm)}
                      aria-pressed={!!active}
                      className={cn(
                        "press shrink-0 rounded-lg px-2 py-1.5 text-left text-sm tabular-nums transition-colors",
                        active
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}
