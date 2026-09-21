import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";

/**
 * Refresh the Supabase auth session inside the proxy and return both the
 * response (carrying refreshed cookies) and the authenticated user. The caller
 * (src/proxy.ts) layers tenant headers onto the returned response.
 *
 * Follows the @supabase/ssr Next.js pattern: a single response object whose
 * cookies are kept in sync with the request.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders?: Headers,
) {
  const baseInit = requestHeaders ? { request: { headers: requestHeaders } } : { request };
  let response = NextResponse.next(baseInit);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next(baseInit);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession) — validates the JWT with the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
