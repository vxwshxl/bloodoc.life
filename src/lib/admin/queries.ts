import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  Camp,
  Donor,
  Profile,
  Registration,
  RegistrationStatus,
} from "@/lib/db/types";

/**
 * Console reads.
 *
 * Everything here runs on the caller's own session, not the service role — so
 * the RLS policies are what enforce "admins only", and a donor who somehow
 * reached these functions would simply get their own rows. The `requireAdmin`
 * call in each page is the redirect, not the protection.
 */

export type RegistrationRow = Registration & { donor: Donor; camp: Camp };

/**
 * What a camp takes with it if it is deleted.
 *
 * `registrations` cascades from the camp, and `certificates` cascades from the
 * registration — so a delete reaches two tables deeper than the row somebody is
 * looking at. The confirm dialog states both numbers rather than saying "this
 * cannot be undone" and leaving the reader to guess the blast radius.
 */
export type CampWithCounts = Camp & { registrationCount: number; certificateCount: number };

export async function listCampsWithCounts(search?: string): Promise<CampWithCounts[]> {
  const supabase = await createClient();
  const camps = await listCamps(search);
  if (camps.length === 0) return [];

  const ids = camps.map((c) => c.id);
  const { data } = await supabase
    .from("registrations")
    .select("camp_id, certificate:certificates(id)")
    .in("camp_id", ids);

  const rows = (data as unknown as { camp_id: string; certificate: unknown }[] | null) ?? [];
  return camps.map((c) => {
    const mine = rows.filter((r) => r.camp_id === c.id);
    return {
      ...c,
      registrationCount: mine.length,
      certificateCount: mine.filter((r) => r.certificate).length,
    };
  });
}

/**
 * Every camp with its roster broken down by outcome — the index the
 * Registrations page opens on.
 *
 * One query for the camps and one for the statuses, tallied here. The obvious
 * alternative is a count per camp per status, which at five statuses and twenty
 * camps is a hundred round trips to render one screen.
 */
export type CampRoster = Camp & {
  total: number;
  byStatus: Record<RegistrationStatus, number>;
};

export async function listCampRosters(): Promise<CampRoster[]> {
  const supabase = await createClient();
  const camps = await listCamps();
  if (camps.length === 0) return [];

  const { data } = await supabase
    .from("registrations")
    .select("camp_id, status")
    .in("camp_id", camps.map((c) => c.id));

  const rows = (data ?? []) as { camp_id: string; status: RegistrationStatus }[];
  return camps.map((c) => {
    const byStatus: Record<RegistrationStatus, number> = {
      registered: 0,
      screened: 0,
      donated: 0,
      deferred: 0,
      cancelled: 0,
    };
    let total = 0;
    for (const r of rows) {
      if (r.camp_id !== c.id) continue;
      total += 1;
      byStatus[r.status] += 1;
    }
    return { ...c, total, byStatus };
  });
}

export async function listCamps(search?: string): Promise<Camp[]> {
  const supabase = await createClient();
  let q = supabase.from("camps").select("*").order("starts_at", { ascending: false });
  if (search?.trim()) {
    const term = `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    q = q.or(`title.ilike.${term},venue.ilike.${term},city.ilike.${term}`);
  }
  const { data } = await q;
  return data ?? [];
}

/**
 * A page of donors, with the total the pager needs.
 *
 * The count comes back in the same round trip as the rows (`count: "exact"`)
 * rather than from a second query: the two would be read at different moments
 * against a table being written to during a camp, and a pager whose last page
 * is empty is worse than no pager.
 */
export async function listDonors(
  search?: string,
  page = 1,
  pageSize = 25,
): Promise<{ rows: Donor[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let q = supabase
    .from("donors")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (search?.trim()) {
    // `%` and `_` are wildcards in `ilike`, and a search box is the one place a
    // user can type them. Escaped so "100%" looks for a literal percent sign
    // rather than matching every donor in the table.
    const term = `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    // `or` across the three columns anybody actually searches by. Phone is in
    // there because the question at the desk is almost always "she called from
    // this number, is she on the list".
    q = q.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`);
  }
  const { data, count } = await q;
  return { rows: data ?? [], total: count ?? 0 };
}

export async function listRegistrations(
  campId?: string,
  page = 1,
  pageSize = 25,
  search?: string,
): Promise<{ rows: RegistrationRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const term = search?.trim();
  const searching = !!term;
  let q = supabase
    .from("registrations")
    .select(
      // `!inner` only while searching. An inner join would otherwise drop any
      // registration whose donor row has been deleted, which is exactly the
      // orphan an admin most needs to see on an unfiltered roster.
      searching
        ? "*, donor:donors!inner(*), camp:camps(*)"
        : "*, donor:donors(*), camp:camps(*)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (campId) q = q.eq("camp_id", campId);
  if (term) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    q = q.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`, {
      referencedTable: "donors",
    });
  }
  const { data, count } = await q;
  return { rows: (data ?? []) as unknown as RegistrationRow[], total: count ?? 0 };
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
    .eq("listed", true)
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

export type DashboardExtras = {
  /** Registrations per day for the last 30 days, oldest first. */
  trend: { label: string; value: number }[];
  /** How the whole register splits by outcome. */
  byStatus: { label: string; value: number }[];
  certificates: { pending: number; approved: number };
  partners: { organisations: number; bloodBanks: number };
};

/**
 * The figures behind the overview's charts.
 *
 * Bucketed in JS for the same reason the blood-group split is: PostgREST has
 * no group-by, and thirty days of registrations is a trivial amount of data to
 * count in memory. If this table ever reaches six figures it becomes a
 * materialised view, not a bigger select.
 */
export async function getDashboardExtras(days = 30): Promise<DashboardExtras> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [regs, certs, partners] = await Promise.all([
    supabase.from("registrations").select("status, created_at"),
    supabase.from("certificates").select("status"),
    supabase.from("partners").select("kind").eq("active", true),
  ]);

  const rows = (regs.data ?? []) as { status: string; created_at: string }[];

  // Every day in the window, including the empty ones. A line that skips days
  // with no registrations compresses a quiet fortnight into a short gap and
  // makes the camp-day spike look like the normal rate.
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const fmt = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
  const trend = [...buckets.entries()].map(([iso, value]) => ({
    label: fmt.format(new Date(`${iso}T00:00:00`)),
    value,
  }));

  const STATUSES = ["registered", "screened", "donated", "deferred", "cancelled"] as const;
  const byStatus = STATUSES.map((s) => ({
    label: s[0].toUpperCase() + s.slice(1),
    value: rows.filter((r) => r.status === s).length,
  }));

  const certRows = (certs.data ?? []) as { status: string }[];
  const partnerRows = (partners.data ?? []) as { kind: string }[];

  return {
    trend,
    byStatus,
    certificates: {
      pending: certRows.filter((c) => c.status === "pending").length,
      approved: certRows.filter((c) => c.status === "approved").length,
    },
    partners: {
      organisations: partnerRows.filter((p) => p.kind === "organisation").length,
      bloodBanks: partnerRows.filter((p) => p.kind === "blood_bank").length,
    },
  };
}

export type ConsoleUser = Profile & {
  donor: Pick<Donor, "id" | "full_name" | "phone" | "blood_group" | "kind" | "department" | "prior_donations"> | null;
  memberships: { partner: { name: string; short_name: string | null; kind: string } | null }[];
};

/**
 * Everybody with an account.
 *
 * Joined to their donor record and their partner memberships, because "who is
 * this person" on this page means all three: the account they sign in with,
 * the donor they are, and the bodies they act for. Three separate lookups per
 * row would be the same data at forty times the round trips.
 */
export async function listUsers(
  search?: string,
  page = 1,
  pageSize = 25,
  role?: string,
): Promise<{ rows: ConsoleUser[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let q = supabase
    .from("profiles")
    .select(
      "*, donor:donors(id, full_name, phone, blood_group, kind, department, prior_donations), memberships:partner_members(partner:partners(name, short_name, kind))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (role === "admin" || role === "donor") q = q.eq("role", role);
  const term = search?.trim();
  if (term) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    q = q.or(`email.ilike.${like},full_name.ilike.${like}`);
  }

  const { data, count } = await q;
  return { rows: (data ?? []) as unknown as ConsoleUser[], total: count ?? 0 };
}

export type RoleCounts = {
  admin: number;
  verifier: number;
  donor: number;
  partnerOwner: number;
  partnerMember: number;
  bloodBanks: number;
  organisations: number;
  unclaimedInvites: number;
};

/** How many people actually hold each role — the reference page is useless without it. */
export async function getRoleCounts(): Promise<RoleCounts> {
  const supabase = await createClient();
  const [profiles, members, partners] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("partner_members").select("role, profile_id"),
    supabase.from("partners").select("kind").eq("active", true),
  ]);

  const p = (profiles.data ?? []) as { role: string }[];
  const m = (members.data ?? []) as { role: string; profile_id: string | null }[];
  const pa = (partners.data ?? []) as { kind: string }[];

  return {
    admin: p.filter((r) => r.role === "admin").length,
    verifier: p.filter((r) => r.role === "verifier").length,
    donor: p.filter((r) => r.role === "donor").length,
    partnerOwner: m.filter((r) => r.role === "owner").length,
    partnerMember: m.filter((r) => r.role === "member").length,
    bloodBanks: pa.filter((r) => r.kind === "blood_bank").length,
    organisations: pa.filter((r) => r.kind === "organisation").length,
    unclaimedInvites: m.filter((r) => !r.profile_id).length,
  };
}
