import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Camp,
  Certificate,
  Donor,
  Partner,
  PartnerKind,
  PartnerMember,
  Registration,
} from "@/lib/db/types";
import type { CampPartnerWithBody } from "@/lib/partners/display";

/**
 * Reads for the partner panel.
 *
 * Every one of these is an unfiltered select. That looks careless and is the
 * opposite: the scoping lives in the policies added in 0008, so a partner's
 * session physically cannot see another partner's camp, and this file has no
 * `where partner_id = …` that a future edit could drop. The one place a
 * partner id appears is where the *page* wants one body's slice of what the
 * session can already see — never as the security boundary.
 */

/**
 * The bodies behind a camp, host first.
 *
 * Public: RLS lets anyone read the partner links of a published camp, because
 * "who is running this and where does my blood go" is the first thing a donor
 * checks and it is printed on the poster anyway.
 */
export const getCampPartners = cache(
  async (campId: string): Promise<CampPartnerWithBody[]> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("camp_partners")
      .select("*, partner:partners(*)")
      .eq("camp_id", campId)
      .order("sort_order", { ascending: true });
    return (data as CampPartnerWithBody[] | null) ?? [];
  },
);

/** Every camp the signed-in partner member is attached to, newest first. */
export async function getPartnerCamps(): Promise<(Camp & { role: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("camp_partners")
    .select("role, camp:camps(*)")
    .order("created_at", { ascending: false });

  const rows = (data as unknown as { role: string; camp: Camp | null }[] | null) ?? [];
  return rows
    .filter((r): r is { role: string; camp: Camp } => r.camp !== null)
    .map((r) => ({ ...r.camp, role: r.role }))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

export type RosterRow = Registration & {
  donor: Donor | null;
  camp: Pick<Camp, "id" | "slug" | "title" | "starts_at"> | null;
  certificate: Pick<Certificate, "id" | "code" | "status"> | null;
};

/**
 * The roster: every registration this member may see, with the donor, the camp
 * and the certificate joined on.
 *
 * The donor join carries full contact details. That is a deliberate decision
 * recorded in 0008 — the blood bank calls donors back with results and the
 * organisation runs the reminder list, and a masked roster moves both jobs onto
 * a spreadsheet with no policies at all. The scope is still the camp: a partner
 * sees a donor because that donor came to their drive.
 */
export async function getPartnerRoster(campId?: string): Promise<RosterRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("registrations")
    .select(
      "*, donor:donors(*), camp:camps(id, slug, title, starts_at), certificate:certificates(id, code, status)",
    )
    .order("created_at", { ascending: false });
  if (campId) q = q.eq("camp_id", campId);
  const { data } = await q;
  return (data as unknown as RosterRow[] | null) ?? [];
}

/**
 * A page of the roster, with the total.
 *
 * The unpaginated `getPartnerRoster` above stays, because the overview's charts
 * need every row to count them — but a table must never render all of them.
 */
export async function getPartnerRosterPage(
  campId?: string,
  page = 1,
  pageSize = 25,
  search?: string,
): Promise<{ rows: RosterRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const term = search?.trim();

  let q = supabase
    .from("registrations")
    .select(
      // `!inner` only while searching. An inner join would otherwise drop a
      // registration whose donor row is missing, which is exactly the orphan
      // worth seeing on an unfiltered roster.
      term
        ? "*, donor:donors!inner(*), camp:camps(id, slug, title, starts_at), certificate:certificates(id, code, status)"
        : "*, donor:donors(*), camp:camps(id, slug, title, starts_at), certificate:certificates(id, code, status)",
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
  return { rows: (data as unknown as RosterRow[] | null) ?? [], total: count ?? 0 };
}

export type CertificateRow = Certificate & {
  registration:
    | (Pick<Registration, "id" | "status"> & {
        donor: Pick<Donor, "id" | "full_name" | "blood_group"> | null;
        camp: Pick<Camp, "id" | "title" | "slug" | "starts_at"> | null;
      })
    | null;
};

/** Certificates for the camps this member partners. */
export async function getPartnerCertificates(
  status?: Certificate["status"],
  page = 1,
  pageSize = 25,
  search?: string,
): Promise<{ rows: CertificateRow[]; total: number }> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  let q = supabase
    .from("certificates")
    .select(
      "*, registration:registrations(id, status, donor:donors(id, full_name, blood_group), camp:camps(id, title, slug, starts_at))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (status) q = q.eq("status", status);
  const term = search?.trim();
  // The code is the searchable field: it is what is printed on the paper
  // somebody is holding when they ring up.
  if (term) q = q.ilike("code", `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const { data, count } = await q;
  return { rows: (data as unknown as CertificateRow[] | null) ?? [], total: count ?? 0 };
}

/** Colleagues on the same partner, for the panel's team list. */
export async function getPartnerMembers(partnerId: string): Promise<PartnerMember[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_members")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * The headline counts for the panel overview.
 *
 * Counted in one pass over the roster rather than five `count` queries: the
 * numbers must agree with each other and with the table underneath them, and
 * five independent counts against a table being written to during a camp do
 * not.
 */
export async function getPartnerSummary(campId?: string) {
  const roster = await getPartnerRoster(campId);
  const by = (s: Registration["status"]) => roster.filter((r) => r.status === s).length;
  return {
    total: roster.length,
    registered: by("registered"),
    screened: by("screened"),
    donated: by("donated"),
    deferred: by("deferred"),
    cancelled: by("cancelled"),
    certificatesPending: roster.filter((r) => r.certificate?.status === "pending").length,
    certificatesApproved: roster.filter((r) => r.certificate?.status === "approved").length,
  };
}

export type VerifiedCertificate = {
  code: string;
  status: Certificate["status"];
  issued_at: string | null;
  donor_name: string;
  blood_group: string;
  camp_title: string;
  camp_date: string;
  venue: string;
  city: string | null;
  partners: { name: string; short_name: string | null; kind: string; parent_institution: string | null }[];
};

/**
 * The public /verify lookup.
 *
 * Runs on the service role on purpose, and is the fourth sanctioned use of it
 * named in lib/supabase/admin.ts. A stranger holding a printed certificate has
 * no session, so there is no policy that could let them through — and the
 * alternative, a policy making every certificate world-readable, would expose
 * the whole table to anyone who guessed a code.
 *
 * What it returns is exactly what is already printed on the paper in the
 * reader's hand: a name, a blood group, a camp and the bodies that ran it. No
 * phone number, no email, no address, no vitals. A revoked or still-pending
 * certificate resolves too — reporting "not valid" is the entire point of a
 * verification page, and 404 would be indistinguishable from a typo.
 */
export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("certificates")
    .select(
      "code, status, issued_at, registration:registrations(donor:donors(full_name, blood_group), camp:camps(id, title, starts_at, venue, city))",
    )
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  const row = data as unknown as {
    code: string;
    status: Certificate["status"];
    issued_at: string | null;
    registration: {
      donor: { full_name: string; blood_group: string } | null;
      camp: {
        id: string;
        title: string;
        starts_at: string;
        venue: string;
        city: string | null;
      } | null;
    } | null;
  } | null;

  if (!row?.registration?.donor || !row.registration.camp) return null;

  const { data: partnerRows } = await admin
    .from("camp_partners")
    .select("role, partner:partners(name, short_name, kind, parent_institution)")
    .eq("camp_id", row.registration.camp.id)
    .order("sort_order", { ascending: true });

  const partners =
    (partnerRows as unknown as {
      partner: {
        name: string;
        short_name: string | null;
        kind: string;
        parent_institution: string | null;
      } | null;
    }[] | null) ?? [];

  return {
    code: row.code,
    status: row.status,
    issued_at: row.issued_at,
    donor_name: row.registration.donor.full_name,
    blood_group: row.registration.donor.blood_group,
    camp_title: row.registration.camp.title,
    camp_date: row.registration.camp.starts_at,
    venue: row.registration.camp.venue,
    city: row.registration.camp.city,
    partners: partners.flatMap((p) => (p.partner ? [p.partner] : [])),
  };
}

// --------------------------------------------------------------------------
// Admin reads.
//
// Same shape as the partner reads above and the same reliance on RLS — an
// admin session simply matches `is_admin()` and sees every row, so these need
// no special client and no extra filter.
// --------------------------------------------------------------------------

export type PartnerWithMembers = Partner & { members: PartnerMember[] };

export async function listPartners(): Promise<PartnerWithMembers[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partners")
    .select("*, members:partner_members(*)")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  return (data as unknown as PartnerWithMembers[] | null) ?? [];
}

export type PartnerDetail = PartnerWithMembers & {
  camps: (Camp & { role: PartnerKind; is_host: boolean })[];
  /** Counts across every camp this body is attached to. */
  stats: { camps: number; registrations: number; donated: number; certificates: number };
};

/**
 * One partner, everything about it: who has access, which camps it ran, and
 * what came of them.
 *
 * The counts are computed from a single registrations read rather than three
 * `count` queries, for the same reason the panel's summary is: numbers shown
 * side by side have to agree with each other, and independent counts against a
 * table being written to during a camp do not.
 */
export async function getPartnerDetail(slug: string): Promise<PartnerDetail | null> {
  const supabase = await createClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("*, members:partner_members(*)")
    .eq("slug", slug)
    .maybeSingle();
  if (!partner) return null;

  const row = partner as unknown as PartnerWithMembers;

  const { data: links } = await supabase
    .from("camp_partners")
    .select("role, is_host, camp:camps(*)")
    .eq("partner_id", row.id);

  const camps = ((links as unknown as
    | { role: PartnerKind; is_host: boolean; camp: Camp | null }[]
    | null) ?? [])
    .filter((l): l is { role: PartnerKind; is_host: boolean; camp: Camp } => l.camp !== null)
    .map((l) => ({ ...l.camp, role: l.role, is_host: l.is_host }))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const campIds = camps.map((c) => c.id);
  let registrations = 0;
  let donated = 0;
  let certificates = 0;

  if (campIds.length > 0) {
    const { data: regs } = await supabase
      .from("registrations")
      .select("status, certificate:certificates(id)")
      .in("camp_id", campIds);
    const list = (regs as unknown as { status: string; certificate: unknown }[] | null) ?? [];
    registrations = list.length;
    donated = list.filter((r) => r.status === "donated").length;
    certificates = list.filter((r) => r.certificate).length;
  }

  return {
    ...row,
    camps,
    stats: { camps: camps.length, registrations, donated, certificates },
  };
}

export type PartnerDashboard = {
  trend: { label: string; value: number }[];
  byStatus: { label: string; value: number }[];
  byGroup: { label: string; value: number }[];
  firstTimers: number;
};

/**
 * The figures behind the partner overview's charts.
 *
 * Built from `getPartnerRoster()` rather than its own queries, so every number
 * on the page is derived from exactly the rows the reader could click through
 * to — and RLS has already decided which those are. A separate set of counting
 * queries would be a second scoping rule to keep in step with the first.
 */
export async function getPartnerDashboard(days = 30): Promise<PartnerDashboard> {
  const roster = await getPartnerRoster();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  // Every day in the window, empty ones included: a line that skips quiet days
  // compresses a slow fortnight and makes the camp-day spike look routine.
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of roster) {
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
    value: roster.filter((r) => r.status === s).length,
  }));

  const groups = new Map<string, number>();
  for (const r of roster) {
    const g = r.donor?.blood_group;
    if (!g || g === "unknown") continue;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  const byGroup = [...groups.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    trend,
    byStatus,
    byGroup,
    firstTimers: roster.filter((r) => r.first_time).length,
  };
}
