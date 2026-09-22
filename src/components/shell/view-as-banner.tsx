import { Eye } from "lucide-react";
import { stopViewingAs } from "@/lib/auth/impersonation-actions";
import { getEffectiveProfile } from "@/lib/auth/impersonation";

/**
 * The strip that says you are not looking at your own account.
 *
 * Deliberately loud, full width, and above everything. An administrator who
 * forgets they are viewing as a donor will read an empty roster as a bug and
 * report it — or worse, make a change believing it was made as that person.
 * It cannot be dismissed, only exited, because dismissing it would leave the
 * state on with nothing on screen saying so.
 */
export async function ViewAsBanner() {
  const e = await getEffectiveProfile();
  if (!e?.viewingAs) return null;

  const who = e.profile.full_name ?? e.profile.email;
  const role =
    e.profile.role === "admin"
      ? "administrator"
      : e.memberships.length > 0
        ? (e.memberships[0].partner.short_name ?? e.memberships[0].partner.name)
        : "donor";

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 print:hidden">
      <span className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        Viewing as <span className="font-bold">{who}</span>
        <span className="opacity-80">({role})</span>
      </span>
      {/* Writes still happen as the administrator — `auth.uid()` never changes —
          so this says so rather than letting someone assume otherwise. */}
      <span className="text-xs opacity-80">
        Anything you change is still recorded as {e.realProfile?.email}.
      </span>
      <form action={stopViewingAs}>
        <button
          type="submit"
          className="press rounded-full bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50"
        >
          Stop
        </button>
      </form>
    </div>
  );
}
