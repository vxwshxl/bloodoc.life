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
 * What the public pages print as a camp's collaborators and blood bank.
 *
 * The camp's own text fields win when they are filled in; the linked
 * `camp_partners` rows are the fallback. It used to be the other way round,
 * and the result was an editor that did nothing: once any partner was linked,
 * changing "In collaboration with" in the camp form saved to the database and
 * never appeared anywhere. The camp form is where an admin edits what the
 * poster says, so it has to be what the site shows.
 *
 * Decided per line, not per camp — a filled collaboration field does not hide
 * the linked blood bank, and vice versa.
 *
 * The rows still matter for everything that is not display: they are what
 * gives a partner's staff access to the camp in their panel (0008).
 */
export function partnerDisplay(
  camp: Pick<Camp, "collaboration" | "partner_name" | "partner_note">,
  rows?: CampPartnerWithBody[] | null,
): PartnerDisplay {
  const sorted = [...(rows ?? [])].sort(
    (a, b) => Number(b.is_host) - Number(a.is_host) || a.sort_order - b.sort_order,
  );
  const linked = (role: string) =>
    sorted
      .filter((r) => r.role === role)
      .map((r) => ({ name: r.partner.name, note: r.partner.parent_institution }));

  return {
    collaborators: camp.collaboration
      ? [{ name: camp.collaboration, note: null }]
      : linked("organisation"),
    bloodBanks: camp.partner_name
      ? [{ name: camp.partner_name, note: camp.partner_note }]
      : linked("blood_bank"),
  };
}
