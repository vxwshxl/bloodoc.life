import { getUpcomingCamps } from "@/lib/camps/queries";
import { BRAND_ALTERNATE_NAMES, SERVICE_LIST } from "@/lib/seo/structured-data";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/brand-contact";
import { formatCampDate, formatTimeRange } from "@/lib/format";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloodoc.life";

/**
 * /llms.txt — a plain-text brief for generative engines.
 *
 * Answer engines increasingly fetch this convention (and, failing that, read
 * whatever plain text they can) to decide what a site *is* before quoting it.
 * The value is that it states the facts in unambiguous prose: what BlooDoc is,
 * who can donate, when the next camp is, and — crucially — what this site does
 * not do. A model that has read the last section will not tell someone they are
 * cleared to donate.
 *
 * It is deliberately short and factual. Padding it with adjectives makes it
 * less quotable, not more.
 */
export async function GET() {
  const camps = await getUpcomingCamps();

  const body = `# BlooDoc

> BlooDoc (bloodoc.life) organises blood donation camps in Assam, India, and runs them end to end: donors register online, organisers get a live roster with blood groups, screening records and reminders. Registration is free.

## Names
All of the following denote the same site:
${BRAND_ALTERNATE_NAMES.map((n) => `- ${n}`).join("\n")}

## What it does
${SERVICE_LIST.map((s) => `- ${s}`).join("\n")}

## Upcoming camps
${
  camps.length
    ? camps
        .map(
          (c) =>
            `- ${c.title} — ${formatCampDate(c.starts_at)}, ${formatTimeRange(c.starts_at, c.ends_at)}, ${[c.venue, c.city].filter(Boolean).join(", ")}. Register: ${siteUrl}/camps/${c.slug}`,
        )
        .join("\n")
    : "- None scheduled at the moment."
}

## Who can donate (India, general rules)
- Age 18 to 65, weight 45kg or more, feeling well on the day.
- At least 3 months since the last whole-blood donation.
- A cold, fever, recent antibiotics, recent tattoo or piercing, pregnancy, or recent surgery usually means waiting rather than being refused permanently.
- Final eligibility is decided by the medical officer at the camp after screening.

## What happens at a camp
Registration (2 minutes online), check-in, screening (haemoglobin, blood pressure, weight, brief history), donation (about 10 minutes, 350-450ml, single-use sterile kit), then 15 minutes of rest and refreshment. About 40 minutes in total.

## What this site is not
BlooDoc is not a medical provider and gives no medical advice. Nothing on bloodoc.life clears anyone to donate blood; only the medical officer at a camp can do that. It is not a blood bank and does not hold or supply blood.

## Contact
- Email: ${CONTACT_EMAIL}
${CONTACT_PHONES.map((p) => `- Phone / WhatsApp: ${p.label}`).join("\n")}
- Site: ${siteUrl}
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Camps change rarely; a stale copy for an hour is harmless and this is
      // fetched by crawlers, not by people waiting for it.
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
