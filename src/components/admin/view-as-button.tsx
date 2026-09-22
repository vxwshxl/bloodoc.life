import { Eye } from "lucide-react";
import { startViewingAs } from "@/lib/auth/impersonation-actions";

/**
 * "See what they see."
 *
 * Only rendered for a donor who actually has an account — a donor entered from
 * a paper slip has no profile to view as, and a disabled button on most rows of
 * the table would be noise.
 */
export function ViewAsButton({
  profileId,
  label,
}: {
  profileId: string;
  label: string;
}) {
  return (
    <form action={startViewingAs}>
      <input type="hidden" name="profileId" value={profileId} />
      <button
        type="submit"
        title={`See the site as ${label}`}
        aria-label={`View as ${label}`}
        className="press inline-flex h-7 items-center gap-1.5 rounded-md border border-app-line px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Eye className="size-3.5" strokeWidth={1.9} aria-hidden />
        View as
      </button>
    </form>
  );
}
