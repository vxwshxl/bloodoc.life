import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Partner, PartnerMember, Profile } from "@/lib/db/types";

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

/**
 * The partners this account may act for, with the body itself joined on.
 *
 * Partner access is a membership, not a value in `profiles.role`. One person
 * can be the NSS coordinator and a blood bank officer, and a role column would
 * force them into two accounts. It also means revoking access is deleting a
 * row rather than rewriting the account that person also donates with.
 */
export const getMyMemberships = cache(
  async (): Promise<(PartnerMember & { partner: Partner })[]> => {
    const user = await getUser();
    if (!user) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("partner_members")
      .select("*, partner:partners(*)")
      .eq("profile_id", user.id);
    return (data as (PartnerMember & { partner: Partner })[] | null) ?? [];
  },
);

/**
 * Gate for the partner panel.
 *
 * Mirrors `requireAdmin`: a redirect rather than a 403, because someone whose
 * membership was removed is not an attacker. RLS refuses the rows underneath
 * either way — this only saves the round trip.
 */
export async function requirePartner() {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  const memberships = await getMyMemberships();
  if (memberships.length === 0) {
    // An admin who wanders in belongs in the console, not at their own /me.
    redirect(profile.role === "admin" ? "/admin" : "/me");
  }
  return { profile, memberships };
}

/**
 * Where a signed-in visitor's "Dashboard" link points, or null when signed out.
 *
 * Admin wins over a partner membership, and a partner membership over /me: an
 * account is sent to the widest thing it can see, because the narrower pages
 * are all reachable from there and the reverse is not true.
 */
export async function getDashboardHref(): Promise<string | null> {
  const profile = await getProfile();
  if (!profile) return null;
  if (profile.role === "admin") return "/admin";
  if (profile.role === "verifier") return "/desk";
  const memberships = await getMyMemberships();
  return memberships.length > 0 ? "/partner" : "/dashboard";
}

/**
 * Gate for the desk console.
 *
 * Administrators are let through as well: the person who set the camp up is
 * often the one covering the desk at 9am, and making them switch accounts to
 * check somebody in would guarantee a shared login instead.
 */
export async function requireVerifier(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (profile.role !== "verifier" && profile.role !== "admin") {
    redirect("/dashboard");
  }
  return profile;
}

/**
 * Gate for work that either an administrator or a partner member may do —
 * recording an outcome at the desk, approving a certificate.
 *
 * `requirePartner` alone was wrong for these: an admin who is not a member of
 * any partner has no membership row, so it redirected them out of a control
 * the database would happily have let them use. The policies in 0008 all read
 * `is_admin() or is_camp_bloodbank(...)`; this makes the redirect agree with
 * them instead of being stricter for no reason.
 */
export async function requireConsoleUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (profile.role === "admin") return profile;
  const memberships = await getMyMemberships();
  if (memberships.length === 0) redirect("/me");
  return profile;
}
