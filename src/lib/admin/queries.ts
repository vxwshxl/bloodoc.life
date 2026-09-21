import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Camp, Donor, Registration } from "@/lib/db/types";

/**
 * Console reads.
 *
 * Everything here runs on the caller's own session, not the service role — so
 * the RLS policies are what enforce "admins only", and a donor who somehow
 * reached these functions would simply get their own rows. The `requireAdmin`
 * call in each page is the redirect, not the protection.
 */

export type RegistrationRow = Registration & { donor: Donor; camp: Camp };

export async function listCamps(): Promise<Camp[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("camps").select("*").order("starts_at", { ascending: false });
  return data ?? [];
}

export async function listDonors(search?: string): Promise<Donor[]> {
  const supabase = await createClient();
  let q = supabase.from("donors").select("*").order("created_at", { ascending: false }).limit(500);
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    // `or` across the three columns anybody actually searches by. Phone is in
    // there because the question at the desk is almost always "she called from
    // this number, is she on the list".
    q = q.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }
  const { data } = await q;
  return data ?? [];
}

export async function listRegistrations(campId?: string): Promise<RegistrationRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("registrations")
    .select("*, donor:donors(*), camp:camps(*)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (campId) q = q.eq("camp_id", campId);
  const { data } = await q;
  return (data ?? []) as unknown as RegistrationRow[];
}

export type Overview = {
  camps: number;
  donors: number;
  registeredForNext: number;
  donatedAllTime: number;
  byGroup: { group: string; count: number }[];
  recent: RegistrationRow[];
  nextCamp: Camp | null;
};

/**
 * The console's front page.
 *
 * Counts come back as `{ count, head: true }` queries rather than by fetching
 * rows and measuring the array — at a few thousand donors the difference is a
 * page that renders and a page that does not.
 */
export async function getOverview(): Promise<Overview> {
  const supabase = await createClient();

  const { data: nextCampRows } = await supabase
    .from("camps")
    .select("*")
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);
  const nextCamp = nextCampRows?.[0] ?? null;

  const [camps, donors, donated, registeredForNext, groups, recent] = await Promise.all([
    supabase.from("camps").select("id", { count: "exact", head: true }),
    supabase.from("donors").select("id", { count: "exact", head: true }),
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("status", "donated"),
    nextCamp
      ? supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("camp_id", nextCamp.id)
      : Promise.resolve({ count: 0 }),
    supabase.from("donors").select("blood_group"),
    supabase
      .from("registrations")
      .select("*, donor:donors(*), camp:camps(*)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  // Grouped in JS rather than with a Postgres aggregate, because PostgREST has
  // no group-by and the alternative is a view. Nine blood groups over a few
  // thousand rows is nothing; if the donor table ever reaches six figures this
  // becomes a materialised view, not a bigger select.
  const counts = new Map<string, number>();
  for (const row of groups.data ?? []) {
    const g = (row as { blood_group: string }).blood_group;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  return {
    camps: camps.count ?? 0,
    donors: donors.count ?? 0,
    donatedAllTime: donated.count ?? 0,
    registeredForNext: registeredForNext.count ?? 0,
    byGroup: [...counts.entries()]
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count),
    recent: (recent.data ?? []) as unknown as RegistrationRow[],
    nextCamp,
  };
}

/** A donor's own view of themselves — their record plus every camp they joined. */
export async function getMyRecord() {
  const supabase = await createClient();
  const { data: donor } = await supabase.from("donors").select("*").maybeSingle();
  if (!donor) return { donor: null, registrations: [] as RegistrationRow[] };

  const { data } = await supabase
    .from("registrations")
    .select("*, donor:donors(*), camp:camps(*)")
    .eq("donor_id", donor.id)
    .order("created_at", { ascending: false });

  return { donor, registrations: (data ?? []) as unknown as RegistrationRow[] };
}
