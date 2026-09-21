/**
 * The people behind BlooDoc.
 *
 * One array, read twice: by the section on the landing page and by the
 * Organization JSON-LD, where `founder` and `employee` are real entity signals
 * — a named, consistently-spelled person attached to an organisation is how a
 * search engine decides the organisation is a thing rather than a page.
 *
 * Role sits above the name everywhere it is rendered. It is the part a reader
 * is scanning for.
 */
export type TeamMember = {
  name: string;
  role: string;
  /** Marks a founder for the structured data; does not change how it looks. */
  founder?: boolean;
};

export const TEAM: TeamMember[] = [
  { name: "Piyansu Dugar", role: "CEO & Founder", founder: true },
  { name: "Nillotpal Bora", role: "Co-founder", founder: true },
  { name: "Veeshal D. Bodosa", role: "CTO" },
  { name: "Jeu Machahary", role: "CDO" },
  { name: "Aakash Agrahari", role: "COO" },
];

/**
 * Initials for the monogram.
 *
 * First and last word only, so "Veeshal D. Bodosa" reads VB rather than VDB —
 * three letters in a round tile is a different shape from two, and a row of
 * monograms that are not the same shape reads as a mistake.
 */
export function initialsOf(name: string): string {
  const parts = name.replace(/\./g, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
