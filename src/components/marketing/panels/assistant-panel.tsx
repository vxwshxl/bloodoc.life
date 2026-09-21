import { Sparkles } from "lucide-react";
import { ConsoleMock, GroupChip } from "./shell";

export function AssistantPanel() {
  return (
    <ConsoleMock active="Assistant" title="Assistant" subtitle="Asks the roster, not the internet">
      <div className="flex h-[560px] flex-col gap-4 rounded-2xl border border-app-line-soft bg-card p-6 shadow-card">
        <div className="ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">
          Who on the roster is O-negative and has donated before?
        </div>

        <div className="flex max-w-[86%] gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Sparkles className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-sm">
            <p>Nine, of whom six have given in the last two years:</p>
            <ul className="mt-3 flex flex-col gap-2">
              {[
                { n: "Nikita Das", d: "Student · Botany · 2 donations" },
                { n: "Arundhati Bez", d: "Faculty · Chemistry · 7 donations" },
                { n: "Samir Choudhury", d: "Staff · Estate · 4 donations" },
              ].map((p) => (
                <li key={p.n} className="flex items-center gap-2.5">
                  <GroupChip group="O-" />
                  <span>
                    <span className="block font-medium">{p.n}</span>
                    <span className="block text-xs text-muted-foreground">{p.d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              …and 6 more. Want me to draft a reminder to all nine?
            </p>
          </div>
        </div>

        <div className="mt-auto flex h-11 items-center rounded-xl border border-border px-4 text-sm text-muted-foreground">
          Ask about donors, camps or stock…
        </div>
      </div>
    </ConsoleMock>
  );
}
