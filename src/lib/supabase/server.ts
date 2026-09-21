import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads and writes the auth cookie through the Next 16 async `cookies()` store.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Writing a cookie during a Server Component render throws. That is
          // fine: the middleware has already refreshed the session by then, and
          // Server Actions / Route Handlers — the places that actually need to
          // write — are allowed to.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Component render — ignore */
          }
        },
      },
    },
  );
}
