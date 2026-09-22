import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getMyMemberships } from "@/lib/auth/dal";

export type DeleteScope = "admin_only" | "delegated";

/**
 * Whether deletion is delegated beyond administrators right now.
 *
 * `cache`d for the render pass: a roster of twenty-five rows asks this
 * twenty-five times otherwise, once per delete button.
 */
export const getDeleteScope = cache(async (): Promise<DeleteScope> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "delete_scope")
    .maybeSingle();
  // Missing row or unreadable table means the migration has not run. The safe
  // reading of "I don't know" is the stricter one.
  return data?.value === "delegated" ? "delegated" : "admin_only";
});

/**
 * May this person delete a registration?
 *
 * The button is drawn from this; the database decides for real. They are
 * deliberately two separate statements of the same rule rather than one, and
 * the duplication is the point: an interface that offers a control the database
 * will refuse teaches people the console is unreliable, and one that hides a
 * control the database would allow is a feature nobody finds. Either mistake is
 * visible; a single source of truth that lives only in the browser would not be
 * a boundary at all.
 *
 * Keep this in step with the policies in 0017.
 */
export const canDeleteRegistrations = cache(async (): Promise<boolean> => {
  const profile = await getProfile();
  if (!profile) return false;
  if (profile.role === "admin") return true;

  if ((await getDeleteScope()) !== "delegated") return false;
  if (profile.role === "verifier") return true;

  // A blood bank member may delete at the camps their bank is attached to.
  // Scoped per camp in the policy; here it is only whether to draw anything.
  const memberships = await getMyMemberships();
  return memberships.some((m) => m.partner?.kind === "blood_bank");
});

/** Admin-only tables: the answer never depends on the setting. */
export const isAdmin = cache(async (): Promise<boolean> => {
  return (await getProfile())?.role === "admin";
});
