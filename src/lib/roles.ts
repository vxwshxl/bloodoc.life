import type { UserRole } from "@/lib/db/types";

/**
 * The roles a console account can hold.
 *
 * In its own module, imported by both the client dropdown and the server page,
 * and that placement is load-bearing rather than tidiness. It used to be
 * exported from `user-row.tsx`, which carries `"use client"` — and a Server
 * Component importing a value from a client module does not get the value. It
 * gets a client *reference proxy*, so the array arrived as an opaque stub and
 * the page died on `ROLES.map is not a function`.
 *
 * Only components survive that crossing, as references. Plain data has to come
 * from a module that is neither, which is what this file is.
 *
 * Worth being straight about the limit: these are the values the `user_role`
 * enum allows. A new role is a migration (the value) plus a second migration
 * (its policies) plus an entry here — never just an entry here, because the
 * database is what actually enforces any of it.
 */
export const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "admin", label: "Administrator", hint: "Sees and changes everything" },
  {
    value: "verifier",
    label: "Verifier",
    hint: "Checks donors in and records outcomes at the desk",
  },
  { value: "donor", label: "Donor", hint: "Sees only their own record" },
];

/**
 * The same list as a tuple, for `z.enum`.
 *
 * Derived rather than written out a second time. The server action had its own
 * hand-kept `z.enum(["admin", "donor"])`, which nobody updated when 0013 added
 * `verifier` — so choosing Verifier failed validation and reported "Unknown
 * user or role", while the label map three lines below it already knew the
 * role existed. A second copy of a list is a second thing to forget.
 */
export const ROLE_VALUES = ROLES.map((r) => r.value) as [UserRole, ...UserRole[]];

/**
 * What the Users page shows and sets: the account's role, with partner access
 * folded in.
 *
 * "Organisation" and "Blood bank" are not values of `profiles.role` — they are
 * memberships of a partner (`partner_members`), which is what the partner
 * policies check. The Users table offers them alongside the three roles
 * because, to the person running the console, "this account belongs to the
 * blood bank" is the same kind of answer as "this account is a verifier".
 * Choosing one asks which body and adds the membership; choosing Donor
 * removes them. Administrator and Verifier win over a membership, because
 * either already sees more than any partner can.
 */
export type Access = UserRole | "organisation" | "blood_bank";

export const ACCESS_OPTIONS: { value: Access; label: string; hint: string }[] = [
  ROLES[0],
  ROLES[1],
  { value: "organisation", label: "Organisation", hint: "Sees the rosters of camps their body runs" },
  {
    value: "blood_bank",
    label: "Blood bank",
    hint: "Records outcomes and approves certificates for their camps",
  },
  ROLES[2],
];

export function accessOf(
  role: UserRole,
  partnerKinds: (string | null | undefined)[],
): Access {
  if (role === "admin" || role === "verifier") return role;
  if (partnerKinds.includes("blood_bank")) return "blood_bank";
  if (partnerKinds.includes("organisation")) return "organisation";
  return role;
}
