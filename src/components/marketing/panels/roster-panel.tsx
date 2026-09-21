import { ConsoleMock, GroupChip } from "./shell";

const ROWS = [
  { name: "Anjali Deka", kind: "Student · Physics", group: "O+", donations: 3, bp: "118/76", status: "Screened" },
  { name: "Rahul Boro", kind: "Student · Commerce", group: "B+", donations: 0, bp: "122/80", status: "Donated" },
  { name: "Dr. Meera Kalita", kind: "Faculty · Zoology", group: "A+", donations: 11, bp: "126/82", status: "Donated" },
  { name: "Priya Sarma", kind: "Student · English", group: "A-", donations: 1, bp: "—", status: "Registered" },
  { name: "Imran Ahmed", kind: "Staff · Library", group: "AB+", donations: 6, bp: "130/84", status: "Donated" },
  { name: "Nikita Das", kind: "Student · Botany", group: "O-", donations: 2, bp: "104/62", status: "Deferred" },
  { name: "Bikash Nath", kind: "Faculty · Maths", group: "O+", donations: 8, bp: "124/79", status: "Screened" },
];

const TONE: Record<string, string> = {
  Donated: "bg-primary/12 text-primary",
  Screened: "bg-muted text-foreground",
  Registered: "bg-muted text-muted-foreground",
  Deferred: "bg-destructive/12 text-destructive",
};

export function RosterPanel() {
  return (
    <ConsoleMock
      active="Registrations"
      title="Roster"
      subtitle="248 registered · filter by group, department or status"
    >
      <div className="mb-4 flex items-center gap-2">
        {["All", "O+", "A+", "B+", "AB+", "Negative only", "First-timers"].map((chip, i) => (
          <span
            key={chip}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              i === 0
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {chip}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-app-line-soft">
              {["Donor", "Group", "Donations", "BP", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={r.name} className={i > 0 ? "border-t border-app-line-soft" : ""}>
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="size-8 shrink-0 rounded-full bg-muted" />
                    <span>
                      <span className="block text-sm font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">{r.kind}</span>
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3"><GroupChip group={r.group} /></td>
                <td className="px-5 py-3 text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.donations === 0 ? "First time" : r.donations}
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.bp}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${TONE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ConsoleMock>
  );
}
