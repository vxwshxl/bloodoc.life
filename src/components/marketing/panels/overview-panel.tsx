import { ConsoleMock, StatTile, GroupChip } from "./shell";

// Two units of whole blood a bag, three components a unit — the numbers below
// are illustrative camp figures, not claims about a real drive.
const STOCK: { group: string; units: number; of: number }[] = [
  { group: "O+", units: 84, of: 100 },
  { group: "A+", units: 62, of: 100 },
  { group: "B+", units: 58, of: 100 },
  { group: "AB+", units: 21, of: 100 },
  { group: "O-", units: 14, of: 100 },
  { group: "A-", units: 9, of: 100 },
];

const RECENT = [
  { name: "Anjali Deka", group: "O+", when: "2 min ago", state: "Screened" },
  { name: "Rahul Boro", group: "B+", when: "6 min ago", state: "Donated" },
  { name: "Priya Sarma", group: "A-", when: "11 min ago", state: "Registered" },
  { name: "Imran Ahmed", group: "AB+", when: "14 min ago", state: "Donated" },
  { name: "Nikita Das", group: "O-", when: "20 min ago", state: "Deferred" },
];

export function OverviewPanel() {
  return (
    <ConsoleMock
      active="Overview"
      title="Camp day — 25 September"
      subtitle="University Auditorium · 09:00–16:00 · live"
    >
      <div className="grid grid-cols-4 gap-4">
        <StatTile label="Registered" value="248" hint="of 300 places" />
        <StatTile label="Donated" value="171" hint="so far today" tone="primary" />
        <StatTile label="Deferred" value="12" hint="4.6% of screened" />
        <StatTile label="First-timers" value="63" hint="25% of the roster" />
      </div>

      <div className="mt-5 grid grid-cols-[1.15fr_1fr] gap-4">
        <div className="rounded-2xl border border-app-line-soft bg-card p-5 shadow-card">
          <p className="text-sm font-semibold">Units by group</p>
          <div className="mt-5 flex h-40 items-end gap-4">
            {STOCK.map((s, i) => (
              <div key={s.group} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end">
                  <div
                    className="animate-bar w-full rounded-t-md bg-primary/80"
                    style={{ height: `${s.units}%`, animationDelay: `${i * 70}ms` }}
                  />
                </div>
                <GroupChip group={s.group} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-app-line-soft bg-card p-5 shadow-card">
          <p className="text-sm font-semibold">At the desk</p>
          <ul className="mt-3 flex flex-col">
            {RECENT.map((r, i) => (
              <li
                key={r.name}
                className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-app-line-soft" : ""}`}
              >
                <span className="size-8 shrink-0 rounded-full bg-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">{r.when}</span>
                </span>
                <GroupChip group={r.group} />
                <span className="w-20 text-right text-xs font-medium text-muted-foreground">
                  {r.state}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ConsoleMock>
  );
}
