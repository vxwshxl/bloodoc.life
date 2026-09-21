import type { Camp, CampPartner, Partner } from "@/lib/db/types";

/**
 * Turning partner rows into the two lines the public pages print.
 *
 * Deliberately not in `queries.ts`: that module is `server-only`, and the
 * EventCard which needs this renders inside the GSAP hero, which is a client
 * component. A pure function with no data access can live on both sides.
 */

export type CampPartnerWithBody = CampPartner & { partner: Partner };

export type PartnerDisplay = {
  /** "In collaboration with" — the mobilising bodies, host first. */
  collaborators: { name: string; note: string | null }[];
  /** "Blood bank partner" — where the units go. */
  bloodBanks: { name: string; note: string | null }[];
};

/**
 * Prefer the rows; fall back to the legacy text columns.
 *
 * 0008 added `camp_partners` and left `camps.collaboration` / `partner_name` /
 * `partner_note` in place rather than dropping them in the same migration,
 * precisely so this fallback exists: a camp created before the change, or one
 * an admin has not yet attached partners to, keeps printing what it always
 * printed instead of losing its collaborators the moment the deploy lands.
 *
 * When 0009 drops those columns, the second half of this function goes with
 * them and nothing else has to change.
 */
export function partnerDisplay(
  camp: Pick<Camp, "collaboration" | "partner_name" | "partner_note">,
  rows?: CampPartnerWithBody[] | null,
): PartnerDisplay {
  if (rows && rows.length > 0) {
    const sorted = [...rows].sort(
      (a, b) => Number(b.is_host) - Number(a.is_host) || a.sort_order - b.sort_order,
    );
    return {
      collaborators: sorted
        .filter((r) => r.role === "organisation")
        .map((r) => ({ name: r.partner.name, note: r.partner.parent_institution })),
      bloodBanks: sorted
        .filter((r) => r.role === "blood_bank")
        .map((r) => ({ name: r.partner.name, note: r.partner.parent_institution })),
    };
  }

  return {
    collaborators: camp.collaboration ? [{ name: camp.collaboration, note: null }] : [],
    bloodBanks: camp.partner_name
      ? [{ name: camp.partner_name, note: camp.partner_note }]
      : [],
  };
}
