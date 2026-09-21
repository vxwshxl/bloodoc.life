/**
 * The site's search identity, in one place.
 *
 * Search engines and answer engines (Google AI Overviews, ChatGPT, Perplexity,
 * Gemini) resolve a query to an *entity* before they rank anything. Prose on a
 * page is a weak signal for that; a linked JSON-LD graph is a strong one. So
 * every name the site is known by, the organisation behind it and what it
 * actually does are declared once here and emitted as a single `@graph` with
 * cross-referenced `@id`s.
 *
 * One graph, not three script tags: the `@id` references are what tell Google
 * that the Organization, the WebSite and the Event are facets of one entity.
 * Three disconnected blobs make three weak entities competing with each other.
 */

import {
  CONTACT_EMAIL,
  CONTACT_PHONES,
  ORG_CITY,
  ORG_COUNTRY,
  ORG_NAME,
  ORG_REGION,
} from "@/lib/brand-contact";
import type { Camp } from "@/lib/db/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloodoc.life";

export const PRODUCT_NAME = "BlooDoc";
export const PRODUCT_TAGLINE = "Blood donation camps, from the sign-up form to the roster.";

/**
 * Every way a real person types this into a search box.
 *
 * `alternateName` is the specific, supported mechanism for telling Google that
 * distinct strings denote the same entity. "BlooDoc" is a coined compound that
 * will be mistyped as two words and as "blood doc" for as long as it exists, so
 * the misspellings are declared rather than hoped away.
 */
export const BRAND_ALTERNATE_NAMES = [
  "BlooDoc",
  "Bloodoc",
  "Bloo Doc",
  "Blood Doc",
  "BlooDoc Life",
  "bloodoc.life",
  "BlooDoc blood donation",
];

export const SERVICE_LIST = [
  "Blood donation camp registration",
  "Donor records and blood group register",
  "Camp roster and screening records",
  "Donor eligibility guidance",
  "Donation reminders and certificates",
  "Blood donation camp management for organisers",
];

const ORG_ID = `${siteUrl}/#organization`;
const SITE_ID = `${siteUrl}/#website`;

const DESCRIPTION =
  "BlooDoc runs blood donation camps end to end: donors register online in two minutes, organisers get a live roster with blood groups, screening records and reminders, and every donor's details carry from one camp to the next.";

/** The stable part of the graph — everything except a specific camp. */
export function siteStructuredData(camp?: Camp | null) {
  const graph: Record<string, unknown>[] = [
    {
      "@type": ["Organization", "MedicalOrganization"],
      "@id": ORG_ID,
      name: ORG_NAME,
      alternateName: BRAND_ALTERNATE_NAMES,
      url: siteUrl,
      description: DESCRIPTION,
      email: CONTACT_EMAIL,
      logo: { "@type": "ImageObject", url: `${siteUrl}/icon.svg` },
      address: {
        "@type": "PostalAddress",
        addressLocality: ORG_CITY,
        addressRegion: ORG_REGION,
        addressCountry: ORG_COUNTRY,
      },
      areaServed: { "@type": "Country", name: "India" },
      contactPoint: CONTACT_PHONES.map((p) => ({
        "@type": "ContactPoint",
        telephone: `+${p.digits}`,
        contactType: "customer support",
        areaServed: "IN",
        availableLanguage: ["en", "hi", "as"],
      })),
      knowsAbout: SERVICE_LIST,
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID,
      url: siteUrl,
      name: PRODUCT_NAME,
      alternateName: BRAND_ALTERNATE_NAMES,
      description: DESCRIPTION,
      publisher: { "@id": ORG_ID },
      inLanguage: "en-IN",
    },
  ];

  if (camp) graph.push(campEvent(camp));
  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * A camp, as an Event.
 *
 * `isAccessibleForFree` and a zero-price Offer are what get the date into a
 * rich result rather than a bare link — an event with no offer is treated as
 * incomplete. Giving blood is free, so saying so is both true and useful.
 */
export function campEvent(camp: Camp) {
  return {
    "@type": "Event",
    "@id": `${siteUrl}/camps/${camp.slug}#event`,
    name: camp.title,
    description: camp.summary ?? DESCRIPTION,
    startDate: camp.starts_at,
    ...(camp.ends_at ? { endDate: camp.ends_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url: `${siteUrl}/camps/${camp.slug}`,
    isAccessibleForFree: true,
    location: {
      "@type": "Place",
      name: camp.venue,
      address: {
        "@type": "PostalAddress",
        streetAddress: camp.venue,
        addressLocality: camp.city ?? ORG_CITY,
        addressRegion: ORG_REGION,
        addressCountry: ORG_COUNTRY,
      },
    },
    organizer: { "@id": ORG_ID },
    ...(camp.capacity ? { maximumAttendeeCapacity: camp.capacity } : {}),
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${siteUrl}/camps/${camp.slug}`,
      validFrom: camp.created_at,
    },
  };
}

/**
 * A FAQPage graph.
 *
 * This is the single highest-leverage piece of markup on the site for answer
 * engines: it is a list of questions with unambiguous answers, in the exact
 * shape a model quotes. The answers are therefore written to stand alone, not
 * to read well in sequence on the page.
 */
export function faqStructuredData(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/faq#faq`,
    isPartOf: { "@id": SITE_ID },
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
