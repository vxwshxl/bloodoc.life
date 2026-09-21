import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * The service-role client. Outside RLS entirely, so every caller is responsible
 * for the check the database would otherwise have made — see `requireAdmin` in
 * lib/auth/dal.ts, which is what the console's server actions go through.
 *
 * Used for exactly three things: the OTP table (which has RLS on and no
 * policies, so nothing else can reach it), the email log, and minting a session
 * for a verified email. If a fourth use appears, it needs a reason.
 *
 * Constructed per call rather than at module load so a missing key surfaces as
 * a failed action rather than a blank page from a module that threw on import.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured (SUPABASE_SECRET_KEY).");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function adminConfigured(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY;
}
