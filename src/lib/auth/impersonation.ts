import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth/dal";
import type { Partner, PartnerMember, Profile } from "@/lib/db/types";

export const IMPERSONATION_COOKIE = "bloodoc_view_as";

/**
 * "View as" — an administrator seeing the console exactly as somebody else
 * sees it.
 *
 * What this is and is not, because the distinction is the whole safety
 * argument: it changes what the *application* resolves as the current profile.
 * It does not change `auth.uid()`, so every RLS policy underneath still
 * evaluates against the administrator's own session. That means it can never
 * grant access the administrator did not already have — an admin already reads
 * every table — and it cannot be used to escalate. It is a rehearsal of
 * somebody else's view, not a login as them.
 *
 * The consequence to be honest about: a *write* made while viewing as someone
 * else is performed by the administrator and the audit trigger records it as
 * such, because `auth.uid()` is still theirs. That is the correct attribution
 * and not a bug — but it is why the banner stays on screen the entire time.
 */
export type ViewAs = { profileId: string };

export const getViewAs = cache(async (): Promise<ViewAs | null> => {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ViewAs;
    return parsed?.profileId ? parsed : null;
  } catch {
    // A cookie somebody hand-edited. Ignored rather than thrown: the worst
    // outcome of a malformed value should be seeing your own account.
    return null;
  }
});

export type EffectiveProfile = {
  profile: Profile;
  /** True when an administrator is currently viewing as somebody else. */
  viewingAs: boolean;
  /** The administrator doing the viewing, when they are. */
  realProfile: Profile | null;
  memberships: (PartnerMember & { partner: Partner })[];
};

/**
 * The profile the app should render for.
 *
 * Everything that asks "who is this and what may they see" reads from here, so
 * a page cannot accidentally be the one that ignores the switch.
 */
export const getEffectiveProfile = cache(async (): Promise<EffectiveProfile | null> => {
  const real = await getProfile();
  if (!real) return null;

  const base: EffectiveProfile = {
    profile: real,
    viewingAs: false,
    realProfile: null,
    memberships: [],
  };

  // Only a real administrator may do this. Checked against the database row
  // rather than anything in the request, so setting the cookie by hand
  // achieves nothing.
  if (real.role !== "admin") return base;

  const target = await getViewAs();
  if (!target || target.profileId === real.id) return base;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", target.profileId)
    .maybeSingle();

  // A stale target — the account was deleted while the cookie survived. Fall
  // back to the administrator's own view rather than erroring.
  if (!profile) return base;

  const { data: memberships } = await admin
    .from("partner_members")
    .select("*, partner:partners(*)")
    .eq("profile_id", profile.id);

  return {
    profile: profile as Profile,
    viewingAs: true,
    realProfile: real,
    memberships: (memberships as (PartnerMember & { partner: Partner })[] | null) ?? [],
  };
});

/** Where "view as" should land for this target, mirroring getDashboardHref. */
export function landingFor(e: EffectiveProfile): string {
  if (e.profile.role === "admin") return "/admin";
  return e.memberships.length > 0 ? "/partner" : "/me";
}

/**
 * The donor record and camp history for whoever is effectively signed in.
 *
 * Reads through the service role when an administrator is viewing as someone
 * else, because RLS resolves `auth.uid()` to the *administrator* — so the
 * ordinary `donors` select would hand back the admin's own record (or nothing)
 * rather than the person whose view is being rehearsed. Safe because the branch
 * is only reachable once `getEffectiveProfile` has confirmed a real admin, and
 * an admin may read every donor anyway.
 *
 * For everybody else it is the plain session query, unchanged.
 */
export async function getEffectiveRecord() {
  const e = await getEffectiveProfile();
  if (!e) return { donor: null, registrations: [] as unknown[] };

  const { getMyRecord } = await import("@/lib/admin/queries");
  if (!e.viewingAs) return getMyRecord();

  const admin = createAdminClient();
  const { data: donor } = await admin
    .from("donors")
    .select("*")
    .eq("profile_id", e.profile.id)
    .maybeSingle();
  if (!donor) return { donor: null, registrations: [] as unknown[] };

  const { data } = await admin
    .from("registrations")
    .select("*, donor:donors(*), camp:camps(*)")
    .eq("donor_id", donor.id)
    .order("created_at", { ascending: false });

  return { donor, registrations: data ?? [] };
}
