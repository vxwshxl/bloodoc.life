import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Two jobs, in this order: keep the Supabase session fresh on every request,
 * and bounce the obvious cases before a page renders.
 *
 * The auth check here is presence-only and deliberately so. It knows whether a
 * cookie resolves to a user, not what that user may do — the real checks are
 * `requireAdmin` in the DAL and the RLS policies underneath it. A proxy that
 * tried to enforce roles would be a second, weaker copy of the rules, and the
 * two would drift.
 */
const PROTECTED_PREFIXES = ["/admin", "/me", "/partner"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (isProtected(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    // So the donor lands where they were going rather than on the home page.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // A signed-in visitor has no business on the sign-in screen. The landing page
  // is exempt: it is the public page, and its header offers "Dashboard" instead
  // of "Sign in" to someone who is already in.
  if (user && pathname === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/me";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt|xml)$).*)",
  ],
};
