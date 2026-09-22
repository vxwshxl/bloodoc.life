"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/dal";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";

/**
 * Start viewing as somebody else.
 *
 * `requireAdmin` is the gate and it is a real one here, unlike most of the
 * redirects in this codebase: there is no RLS policy behind this, because the
 * cookie is not a credential — it only tells the app which profile to render
 * for. `getEffectiveProfile` re-checks the administrator's role on every read
 * anyway, so a cookie planted by a donor resolves to nothing.
 */
export async function startViewingAs(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId || profileId === admin.id) return;

  // Confirm the target exists before writing a cookie that points at it.
  const { data: target } = await createAdminClient()
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return;

  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, JSON.stringify({ profileId }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Session-length on purpose. Viewing as someone is something you do for a
    // minute to answer a question, and a preference that outlived the tab
    // would have administrators quietly working as a donor a week later.
    maxAge: 60 * 60,
  });

  // Each role has its own console now, so the landing follows the target's.
  redirect(
    target.role === "admin" ? "/admin" : target.role === "verifier" ? "/desk" : "/dashboard",
  );
}

export async function stopViewingAs(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/admin");
}
