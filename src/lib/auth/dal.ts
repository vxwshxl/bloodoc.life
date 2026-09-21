import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db/types";

/**
 * The data access layer: every check of "who is this and what are they allowed
 * to do" goes through here, so there is one answer rather than one per page.
 *
 * `cache` dedupes within a render pass — a layout, a page and three server
 * components all asking for the current profile is one round trip, not five.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  // `getUser` and not `getSession`: the session is read from a cookie the
  // browser controls, so it is only ever a claim. getUser validates it with
  // the auth server, which is what makes this safe to gate on.
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/signin");
  return user;
}

/**
 * Admin-only pages and actions.
 *
 * Redirects rather than 403s: a donor who follows a stale /admin link is not an
 * attacker, and the honest place to send them is their own page. The database
 * refuses the query underneath regardless — this only saves the round trip and
 * gives a better landing.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (profile.role !== "admin") redirect("/me");
  return profile;
}

/** Where a signed-in visitor's "Dashboard" link points, or null when signed out. */
export async function getDashboardHref(): Promise<string | null> {
  const profile = await getProfile();
  if (!profile) return null;
  return profile.role === "admin" ? "/admin" : "/me";
}
