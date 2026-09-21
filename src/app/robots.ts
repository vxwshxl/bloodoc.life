import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloodoc.life";

/**
 * Open to crawlers, closed over the signed-in surfaces.
 *
 * `/admin` and `/me` are already gated, and crawling them would only waste
 * budget that should go to the camp pages — which are the URLs with a date and
 * a place in them, and therefore the ones that can actually rank.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/me", "/api", "/signin"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
