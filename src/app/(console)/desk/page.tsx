import { redirect } from "next/navigation";
import { listCamps } from "@/lib/admin/queries";

/**
 * The desk opens on today's camp, not on a chooser.
 *
 * Whoever is standing at the table is working one drive, and the one running
 * now is a safe guess — the alternative is asking them to pick from a list
 * every time they reload on a phone with one bar of signal. They can still
 * reach every other roster from the nav.
 */
export default async function DeskHome() {
  const camps = await listCamps();
  const now = Date.now();

  const running = camps.find((c) => {
    const start = new Date(c.starts_at).getTime();
    const end = new Date(c.ends_at ?? c.starts_at).getTime();
    // A generous window either side: doors open before the advertised hour and
    // the last donor is always after it.
    return now >= start - 3 * 3600_000 && now <= end + 3 * 3600_000;
  });

  const next = camps
    .filter((c) => c.status === "published" && new Date(c.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  const pick = running ?? next;
  redirect(pick ? `/desk/roster?camp=${pick.id}` : "/desk/roster");
}
