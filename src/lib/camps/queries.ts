import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Camp } from "@/lib/db/types";

/**
 * The camp the landing page leads with: the next published one that has not
 * finished yet.
 *
 * `ends_at` is preferred over `starts_at` for the cutoff so a camp running
 * 9am–4pm does not disappear from the site at 9:01, which is exactly when
 * somebody is looking it up on their phone from the queue.
 */
export async function getNextCamp(): Promise<Camp | null> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("camps")
    .select("*")
    .eq("status", "published")
    .or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`)
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Every published camp still to come — the /camps page. */
export async function getUpcomingCamps(): Promise<Camp[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("camps")
    .select("*")
    .eq("status", "published")
    .gte("starts_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true });
  return data ?? [];
}

export async function getCampBySlug(slug: string): Promise<Camp | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("camps").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}
