import type { MetadataRoute } from "next";
import { getUpcomingCamps } from "@/lib/camps/queries";
import { LEGAL_DOCS } from "@/lib/legal/documents";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloodoc.life";

/**
 * The public surface only.
 *
 * A sitemap is a statement about what matters. Listing /signin would say the
 * sign-in screen is one of this site's important pages; what is important is
 * the home page and each camp, because a camp is the thing with a date and a
 * venue that someone searches for.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const camps = await getUpcomingCamps();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/camps`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/eligibility`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...camps.map((c) => ({
      url: `${siteUrl}/camps/${c.slug}`,
      // The camp's own revision date, so a crawler is told which camp actually
      // changed rather than being pointed at the whole list.
      lastModified: new Date(c.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    // Each document carries its own revision date, so a crawler is told which
    // policy actually changed rather than being pointed at the whole set.
    ...LEGAL_DOCS.map((doc) => ({
      url: `${siteUrl}/legal/${doc.slug}`,
      lastModified: new Date(doc.updated),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
