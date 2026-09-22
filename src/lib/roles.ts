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
 * Worth being straight about the limit: these are the two values the
 * `user_role` enum allows, and every RLS policy in the schema asks
 * `role = 'admin'`. Custom roles with their own permission sets would mean a
 * permissions table and a rewrite of every policy — a far larger change than
 * adding an entry here.
 */
export const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: "admin", label: "Administrator", hint: "Sees and changes everything" },
  { value: "donor", label: "Donor", hint: "Sees only their own record" },
];
