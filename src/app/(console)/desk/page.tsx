import type { Metadata } from "next";
import { listCamps } from "@/lib/admin/queries";
import DeskRoster from "./roster/page";

export const metadata: Metadata = { title: "Roster" };

/**
 * The desk opens on today's camp, not on a chooser.
 *
 * Whoever is standing at the table is working one drive, and the one running
 * now is a safe guess — the alternative is asking them to pick from a list
 * every time they reload on a phone with one bar of signal. They can still
 * reach every other roster from the nav.
 *
 * Rendered here rather than redirected to /desk/roster. The redirect left the
 * page blank when "Roster" was clicked from that same roster: the server sent
 * the router back to the URL it was already on, and it rendered nothing.
 * A camp chosen from the filter wins over the guess.
 */
export default async function DeskHome({
  searchParams,
}: {
  searchParams: Promise<{ camp?: string; page?: string; q?: string }>;
}) {
  const params = await searchParams;
  if (params.camp) return <DeskRoster searchParams={Promise.resolve(params)} />;

  const pick = await todaysCamp();
  return <DeskRoster searchParams={Promise.resolve({ ...params, camp: pick?.id })} />;
}

/** The camp running now, or failing that the next published one. */
async function todaysCamp() {
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

  return running ?? next;
}
