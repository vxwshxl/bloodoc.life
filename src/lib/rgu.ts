/**
 * The schools of The Assam Royal Global University and their departments.
 *
 * Taken from the university's own "Schools at RGU" page (rgu.ac/schools-rgu),
 * names exactly as it writes them, in September 2026. A school listed there
 * with no departments of its own has an empty list here, and the form does not
 * ask for one — the school is the answer.
 *
 * Donors are mostly RGU students and staff, so the form offers a list rather
 * than a text box: typed departments came back as "Phy", "physics dept" and
 * "PHYSICS", which is three rows in a roster grouped by department. Anyone the
 * list does not fit picks "Other" and types.
 *
 * When the university adds a school, add it here. Nothing in the database
 * constrains these values; the registration action checks against this list.
 */
export type RguSchool = {
  id: string;
  /** As the university writes it, abbreviation included. Stored on the donor. */
  name: string;
  /** Department names without the "Department of" prefix. */
  departments: readonly string[];
};

export const RGU_SCHOOLS: readonly RguSchool[] = [
  { id: "rsaf", name: "Royal School of Agriculture and Forestry (RSAF)", departments: ["Agriculture", "Forestry"] },
  { id: "rsaps", name: "Royal School of Applied & Pure Sciences (RSAPS)", departments: ["Physics", "Chemistry", "Mathematics"] },
  { id: "rsa", name: "Royal School of Architecture (RSA)", departments: ["Architecture"] },
  { id: "rsbas", name: "Royal School of Behavioral & Allied Sciences (RSBAS)", departments: [] },
  { id: "rsbsc", name: "Royal School of Bio-sciences (RSBSC)", departments: ["Biotechnology", "Microbiology", "Food Technology"] },
  { id: "rsb", name: "Royal School of Business (RSB)", departments: [] },
  { id: "rsc", name: "Royal School of Commerce (RSC)", departments: [] },
  { id: "rscom", name: "Royal School of Communications & Media (RSCOM)", departments: [] },
  { id: "rsd", name: "Royal School of Design (RSD)", departments: ["Product Design", "Communication Design", "Interior Design", "Graphic Design", "Fashion Design"] },
  { id: "rset", name: "Royal School of Engineering and Technology (RSET)", departments: ["Computer Science", "Mechanical Engineering", "Civil Engineering"] },
  { id: "rsees", name: "Royal School of Environmental and Earth Sciences (RSEES)", departments: ["Geography and Geoinformatics", "Environmental Science", "Geology"] },
  { id: "rsfd", name: "Royal School of Fashion Design (RSFD)", departments: [] },
  { id: "rsfa", name: "Royal School of Fine Arts (RSFA)", departments: [] },
  { id: "rshm", name: "Royal School of Hotel Management (RSHM)", departments: [] },
  { id: "rshss", name: "Royal School of Humanities and Social Sciences (RSHSS)", departments: ["Economics", "History", "Public Administration", "Sociology", "Social Work", "IKS"] },
  { id: "rsit", name: "Royal School of Information Technology (RSIT)", departments: [] },
  { id: "rsl", name: "Royal School of Languages (RSL)", departments: ["English", "Assamese"] },
  { id: "rsla", name: "Royal School of Law & Administration (RSLA)", departments: [] },
  { id: "rslisc", name: "Royal School of Library & Information Science (RSLISC)", departments: [] },
  { id: "rslsc", name: "Royal School of Life Sciences (RSLSC)", departments: ["Botany", "Zoology", "Forensic Science", "Forestry"] },
  { id: "rsmas", name: "Royal School of Medical & Allied Science (RSMAS)", departments: ["Physiotherapy", "Optometry", "Anaesthesia and Operation Theatre Technology", "Medical Laboratory Sciences", "Medical Radiology and Imaging Technology", "Food Science & Nutrition", "Dialysis Therapy Technology", "Emergency Medical Technology"] },
  { id: "rsn", name: "Royal School of Nursing (RSN)", departments: [] },
  { id: "rsps", name: "Royal School of Pharmaceutical Sciences", departments: [] },
  { id: "rsp", name: "Royal School of Pharmacy (RSP)", departments: [] },
  { id: "rspes", name: "Royal School of Physical Education and Sports (RSPES)", departments: [] },
  { id: "rsttm", name: "Royal School of Travel & Tourism (RSTTM)", departments: [] },
  { id: "iks", name: "Indian Knowledge Systems (IKS)", departments: [] },
  { id: "icsp", name: "Integrated Civil Service Programme", departments: [] },
];

/** Not an RGU school, or an office outside one — the department is typed. */
export const OTHER_SCHOOL = "other";

export const SCHOOL_OPTIONS = [
  ...RGU_SCHOOLS.map((s) => ({ value: s.id, label: s.name })),
  { value: OTHER_SCHOOL, label: "Other / central office" },
];

export function schoolById(id: string | null | undefined): RguSchool | undefined {
  return RGU_SCHOOLS.find((s) => s.id === id);
}

/** A stored school name back to its id, for pre-filling a form. */
export function schoolIdForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return RGU_SCHOOLS.find((s) => s.name === name)?.id;
}

/**
 * The school's name without its abbreviation — "Royal School of Business" —
 * which is what `department` holds for a school with no departments of its
 * own, so a roster grouped by department still has a row for it.
 */
export function schoolPlainName(s: RguSchool): string {
  return s.name.replace(/\s*\([A-Z]+\)$/, "");
}
