import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listCamps } from "@/lib/admin/queries";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import type { Camp, CertificateStatus, Donor } from "@/lib/db/types";

/**
 * Reads for the console's Certificates page.
 *
 * On the session client like every console read: an administrator's session
 * matches every row, and nothing here needs to filter for security.
 */

export type CertificateCamp = Camp & {
  total: number;
  byStatus: Record<CertificateStatus, number>;
};

/** Every camp with its certificates tallied by state — the page's index. */
export async function listCertificateCamps(): Promise<CertificateCamp[]> {
  const supabase = await createClient();
  const camps = await listCamps();
  if (camps.length === 0) return [];

  const { data } = await supabase
    .from("certificates")
    .select("status, registration:registrations!inner(camp_id)");
  const rows =
    (data as unknown as { status: CertificateStatus; registration: { camp_id: string } }[] | null) ?? [];

  return camps.map((c) => {
    const byStatus: Record<CertificateStatus, number> = { approved: 0, pending: 0, revoked: 0 };
    let total = 0;
    for (const r of rows) {
      if (r.registration.camp_id !== c.id) continue;
      total += 1;
      byStatus[r.status] += 1;
    }
    return { ...c, total, byStatus };
  });
}

type Partnerish = VerifiedCertificate["partners"][number];

/** The bodies behind each camp, host first, keyed by camp id. */
async function partnersByCamp(campIds: string[]): Promise<Map<string, Partnerish[]>> {
  const out = new Map<string, Partnerish[]>();
  if (campIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("camp_partners")
    .select("camp_id, partner:partners(name, short_name, kind, parent_institution, logo_url)")
    .in("camp_id", campIds)
    .order("sort_order", { ascending: true });
  for (const row of (data as unknown as { camp_id: string; partner: Partnerish | null }[] | null) ?? []) {
    if (!row.partner) continue;
    out.set(row.camp_id, [...(out.get(row.camp_id) ?? []), row.partner]);
  }
  return out;
}

/**
 * The certificate as `CertificateView` draws it — the same shape /verify
 * builds, so the console's preview and download are the page the donor gets.
 */
function printable(
  c: { code: string; status: CertificateStatus; issued_at: string | null },
  donor: Pick<Donor, "full_name" | "blood_group">,
  camp: Camp,
  partners: Partnerish[],
): VerifiedCertificate {
  return {
    code: c.code,
    status: c.status,
    issued_at: c.issued_at,
    donor_name: donor.full_name,
    blood_group: donor.blood_group,
    camp_title: camp.title,
    camp_date: camp.starts_at,
    venue: camp.venue,
    city: camp.city,
    art: camp.certificate_art,
    organiser: camp.organiser,
    collaboration: camp.collaboration,
    partner_name: camp.partner_name,
    partner_note: camp.partner_note,
    partners,
  };
}

export type CertificateListRow = {
  id: string;
  code: string;
  status: CertificateStatus;
  issued_at: string | null;
  revoked_reason: string | null;
  emailed_at: string | null;
  donor: Donor;
  camp: Camp;
  print: VerifiedCertificate;
};

/**
 * Codes look like BD-2026-9F3A7C and always carry a digit; names never do.
 * Somebody reading "9F3A7C" off a printout is searching for a code.
 */
const looksLikeCode = (s: string) => /^bd-/i.test(s) || /\d/.test(s);

/**
 * A page of certificates with the donor's whole record and the camp behind
 * each, for the table and the popup.
 *
 * Search is by code or by donor name, chosen by what was typed: PostgREST
 * cannot OR a column with a column two joins away, and nobody types half a
 * code and half a name.
 */
export async function listCertificates(opts: {
  campId?: string;
  status?: CertificateStatus;
  q?: string;
  from: number;
  to: number;
}): Promise<{ rows: CertificateListRow[]; total: number }> {
  const supabase = await createClient();
  let query = supabase
    .from("certificates")
    .select(
      "id, code, status, issued_at, revoked_reason, emailed_at, registration:registrations!inner(camp_id, donor:donors!inner(*), camp:camps(*))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(opts.from, opts.to);

  if (opts.campId) query = query.eq("registration.camp_id", opts.campId);
  if (opts.status) query = query.eq("status", opts.status);
  const term = opts.q?.trim();
  if (term) {
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = looksLikeCode(term)
      ? query.ilike("code", like)
      : query.ilike("registration.donor.full_name", like);
  }

  const { data, count } = await query;
  type Raw = Omit<CertificateListRow, "donor" | "camp" | "print"> & {
    registration: { camp_id: string; donor: Donor; camp: Camp | null };
  };
  const raw = ((data as unknown as Raw[] | null) ?? []).filter((r) => r.registration.camp);
  const partners = await partnersByCamp([...new Set(raw.map((r) => r.registration.camp_id))]);

  return {
    total: count ?? 0,
    rows: raw.map(({ registration, ...c }) => ({
      ...c,
      donor: registration.donor,
      camp: registration.camp!,
      print: printable(c, registration.donor, registration.camp!, partners.get(registration.camp_id) ?? []),
    })),
  };
}

/**
 * Every approved certificate at one camp, ready to draw — the bulk download.
 * Approved only: a pending or withdrawn certificate is not something to hand
 * out, and a zip of them would be.
 */
export async function listApprovedCertificates(campId: string): Promise<VerifiedCertificate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("certificates")
    .select(
      "code, status, issued_at, registration:registrations!inner(camp_id, donor:donors(full_name, blood_group), camp:camps(*))",
    )
    .eq("status", "approved")
    .eq("registration.camp_id", campId)
    .order("created_at", { ascending: true });

  type Raw = {
    code: string;
    status: CertificateStatus;
    issued_at: string | null;
    registration: {
      camp_id: string;
      donor: Pick<Donor, "full_name" | "blood_group"> | null;
      camp: Camp | null;
    };
  };
  const raw = (data as unknown as Raw[] | null) ?? [];
  const partners = (await partnersByCamp([campId])).get(campId) ?? [];
  return raw.flatMap((r) =>
    r.registration.donor && r.registration.camp
      ? [printable(r, r.registration.donor, r.registration.camp, partners)]
      : [],
  );
}
