import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCampPartners } from "@/lib/partners/queries";
import type { Camp, Donor, Registration, RegistrationStatus } from "@/lib/db/types";
import { schoolIdForName } from "@/lib/rgu";

/**
 * What both camp reports (Excel and PDF) are built from: the camp, its
 * collaborators and every registration with its donor and certificate number.
 *
 * On the administrator's own session, like every console read: RLS decides
 * which rows come back.
 */

export type ReportPartner = {
  name: string;
  kind: "organisation" | "blood_bank";
  note: string | null;
  logo_url: string | null;
};

export type ReportRow = Registration & {
  donor: Donor | null;
  certificate_code: string | null;
};

export type CampReport = { camp: Camp; partners: ReportPartner[]; rows: ReportRow[] };

export async function loadCampReport(campId: string): Promise<CampReport | null> {
  const supabase = await createClient();
  const { data: camp } = await supabase.from("camps").select("*").eq("id", campId).maybeSingle();
  if (!camp) return null;

  const [{ data }, linked] = await Promise.all([
    supabase
      .from("registrations")
      .select("*, donor:donors(*), certificate:certificates(code)")
      .eq("camp_id", camp.id)
      .order("created_at", { ascending: true }),
    getCampPartners(camp.id),
  ]);

  const rows: ReportRow[] = (
    (data as unknown as (Registration & {
      donor: Donor | null;
      // One per registration, but PostgREST may return the embed as a list.
      certificate: { code: string } | { code: string }[] | null;
    })[] | null) ?? []
  ).map(({ certificate, ...r }) => ({
    ...r,
    certificate_code: (Array.isArray(certificate) ? certificate[0] : certificate)?.code ?? null,
  }));

  // The linked partners carry logos, so they lead. The camp's free-text
  // credits fill in only for a side with no linked partner, as on the site.
  const sorted = [...linked].sort(
    (a, b) => Number(b.is_host) - Number(a.is_host) || a.sort_order - b.sort_order,
  );
  const partners: ReportPartner[] = sorted.map((r) => ({
    name: r.partner.name,
    kind: r.role,
    note: r.partner.parent_institution,
    logo_url: r.partner.logo_url,
  }));
  if (!partners.some((p) => p.kind === "organisation") && camp.collaboration) {
    partners.push({ name: camp.collaboration, kind: "organisation", note: null, logo_url: null });
  }
  if (!partners.some((p) => p.kind === "blood_bank") && camp.partner_name) {
    partners.push({ name: camp.partner_name, kind: "blood_bank", note: camp.partner_note, logo_url: null });
  }

  return { camp, partners, rows };
}

/**
 * The three lists every report carries: everybody, the faculty, the students.
 * Staff and "other" donors are on the first only; the organisers asked for the
 * two groups the college reports on. A download can ask for just one of them.
 */
export const REPORT_LISTS = { all: "All donors", faculty: "Faculty", students: "Students" } as const;
export type ReportList = keyof typeof REPORT_LISTS;

export function reportSections(rows: ReportRow[], only?: ReportList): { name: string; rows: ReportRow[] }[] {
  const sections: Record<ReportList, ReportRow[]> = {
    all: rows,
    faculty: rows.filter((r) => r.donor?.kind === "faculty"),
    students: rows.filter((r) => r.donor?.kind === "student"),
  };
  return (Object.keys(REPORT_LISTS) as ReportList[])
    .filter((list) => !only || list === only)
    .map((list) => ({ name: REPORT_LISTS[list], rows: sections[list] }));
}

/**
 * Whether a report goes out under RGU's logo: the camp names the university,
 * or its donors picked RGU schools on the form. Not every camp is RGU's, and a
 * report must not claim a university that had no part in it.
 */
export function isRguCamp({ camp, partners, rows }: CampReport): boolean {
  const named = [camp.title, camp.venue, camp.organiser, camp.collaboration, ...partners.map((p) => p.name)];
  if (named.some((t) => t && /royal global|\bRGU\b/i.test(t))) return true;
  return rows.some((r) => !!schoolIdForName(r.donor?.school));
}

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  donated: "Donated",
  deferred: "Deferred",
  cancelled: "Cancelled",
  registered: "Registered",
  screened: "Screened",
};

export function countsLine(rows: ReportRow[]): string {
  const n = (s: RegistrationStatus) => rows.filter((r) => r.status === s).length;
  const parts = [
    `${rows.length} registered`,
    `${n("donated")} donated`,
    `${n("screened")} screened`,
    `${n("cancelled")} cancelled`,
  ];
  // Only shown for a camp that still has older deferrals on it.
  if (n("deferred")) parts.push(`${n("deferred")} deferred`);
  return parts.join("  ·  ");
}

/** School, then department, then name: how a college reads a list of its own. */
export function bySchool(a: ReportRow, b: ReportRow): number {
  const k = (r: ReportRow) =>
    [r.donor?.school ?? "~", r.donor?.department ?? r.donor?.occupation ?? "~", r.donor?.full_name ?? ""]
      .join("\u0000")
      .toLowerCase();
  return k(a).localeCompare(k(b));
}

export function capitalise(s: string | undefined) {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

export function bloodGroupLabel(r: ReportRow): string {
  return r.donor?.blood_group === "unknown" ? "Not known" : r.donor?.blood_group ?? "";
}

/** The camp's file name, dated in IST: "<Camp> - report 2026-10-06.xlsx", or "- faculty …" for one list. */
export function reportFileName(camp: Camp, extension: "xlsx" | "pdf", only?: ReportList): string {
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const what = only ? REPORT_LISTS[only].toLowerCase() : "report";
  return `${camp.title.replace(/[\\/:*?"<>|]+/g, "").trim() || "Camp"} - ${what} ${stamp}.${extension}`;
}
