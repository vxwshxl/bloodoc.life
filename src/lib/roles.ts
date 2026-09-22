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
