/**
 * The site's own absolute origin, resolved once.
 *
 * This existed as seven copies of `process.env.NEXT_PUBLIC_SITE_URL ?? "…"`
 * across the metadata, the sitemap, robots, llms.txt and both email modules —
 * with three different fallbacks between them. One of those fallbacks was
 * `http://localhost:3000`, it was the one in the root layout, and the result
 * was a production deployment serving
 * `<meta property="og:image" content="http://localhost:3000/og.png">`. Every
 * link preview on WhatsApp, LinkedIn and Slack came back with no image,
 * because the only machine that could fetch that URL was the laptop it was
 * built on.
 *
 * So the fallback chain here never resolves to localhost anywhere a real
 * request can reach it:
 *
 * 0. A localhost value is discarded outright when the build is on Vercel. This
 *    is not hypothetical tidying: `.env.local` gets copied into a hosting
 *    dashboard wholesale, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` comes
 *    along with it, and because it is set explicitly it beats every fallback
 *    below. The symptom is a production site whose only broken URLs are the
 *    ones nothing on the site itself links to — og:image, the sitemap, the
 *    links inside emails — so it looks fine to everyone except the crawlers.
 *    No deployment is ever served from localhost, so the value is simply wrong
 *    and is treated as absent.
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — the explicit answer, and the only one that knows
 *    about a custom domain. Set this in production.
 * 2. Vercel's production domain, which the platform injects into every build of
 *    a project without anyone configuring it. This is the safety net: a deploy
 *    that forgot step 1 still gets a fetchable absolute URL.
 * 3. Vercel's per-deployment URL, so preview builds have working previews too.
 * 4. localhost, reached only when none of the above exist — i.e. `pnpm dev`.
 *
 * `NEXT_PUBLIC_*` variants are checked first in each pair because the
 * unprefixed ones are server-only, and a client bundle that imported this
 * would silently see `undefined`. Nothing imports it from the client today;
 * this is what stops that becoming a bug the day something does.
 */
const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);

function resolve(): string {
  const production =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deployment =
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() || process.env.VERCEL_URL?.trim();
  const onVercel = !!(production || deployment);

  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  // Honoured unless it is a localhost origin on a deployed build, which cannot
  // be what anyone meant.
  if (explicit && !(onVercel && isLocal(explicit))) return explicit;

  if (production) return `https://${production.replace(/\/+$/, "")}`;
  if (deployment) return `https://${deployment.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/**
 * Absolute, no trailing slash. Read at module load: `NEXT_PUBLIC_*` is inlined
 * at build time anyway, so there is nothing to gain from re-reading it and a
 * per-render `process.env` lookup in `generateMetadata` is not free.
 */
export const SITE_URL = resolve();

/** `SITE_URL` + a path, for the places that need a full href. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
