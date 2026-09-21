import type { Metadata } from "next";

export const SITE_NAME = "BlooDoc";
export const TITLE_SUFFIX = "BlooDoc";

export const OG_IMAGE = {
  // Bump ?v= whenever the image is re-rendered: link-preview crawlers
  // (WhatsApp, LinkedIn, Facebook) cache by URL for weeks.
  url: "/og.png?v=2",
  width: 1200,
  height: 630,
  alt: "BlooDoc: roll up a sleeve, save three lives. Register in two minutes.",
};

/**
 * Metadata for an indexable page.
 *
 * Next merges `openGraph` / `twitter` shallowly by key, so a page that sets
 * only `title` and `canonical` inherits the root layout's og:url and og:title —
 * and every shared link reads as the homepage. Setting the full objects here
 * gives each page its own card, and `canonical` is never forgotten.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = `${title} · ${TITLE_SUFFIX}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      locale: "en_IN",
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
