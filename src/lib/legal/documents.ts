/**
 * The legal documents, as data.
 *
 * Each carries its own `updated` date, so the sitemap can tell a crawler which
 * policy actually changed rather than pointing at the whole set — and so a
 * reader can see at a glance whether the thing they agreed to last year is
 * still the thing on screen.
 *
 * These are an honest starting point written to match what the software
 * actually does. They are not a lawyer's work, and the health-data document in
 * particular should be reviewed by one before this runs a real camp: a donor's
 * medication list and deferral reason are sensitive personal data under the
 * DPDP Act.
 */
export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy",
    updated: "2026-09-21",
    summary: "What BlooDoc collects, why, who sees it, and how to have it removed.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "The registration form: your name, sex, date of birth or age, your parents' names, what you do and where, your email, phone numbers and address, your blood group, and how many times you have donated before.",
          "What is measured at the camp: height, weight, blood pressure, any medication you are taking, and — if you are deferred — the reason.",
          "Nothing else. There is no tracking pixel, no advertising network and no analytics product on this site.",
        ],
      },
      {
        heading: "Why we collect it",
        body: [
          "To run the camp you registered for: to know who is coming, to screen you safely, and to record what happened.",
          "To save you filling the same form in again at the next camp.",
          "To write to you about camps — a confirmation when you register, a reminder the day before, and a note when a new camp is fixed.",
        ],
      },
      {
        heading: "Who can see it",
        body: [
          "You, whenever you sign in.",
          "The people running the camps, through the BlooDoc console.",
          "Nobody else. Donors cannot see each other's records — that is enforced by the database itself, on every table, rather than by the application remembering to check.",
          "We sell nothing to anyone, and we share your details with no third party except the email provider that delivers the message to you.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "Your donor record is kept while it is useful to you — it is what saves you the form each time. Screening records are kept as part of the camp's record.",
          "Ask us to delete your record and we will, within thirty days.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can see everything we hold about you on your own page, at any time.",
          "You can have it corrected, or deleted. Write to hello@bloodoc.life from the address on your record and we will do it.",
          "You can stop the emails without deleting anything.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms",
    updated: "2026-09-21",
    summary: "What BlooDoc is, what it is not, and what you agree to by registering.",
    sections: [
      {
        heading: "What this is",
        body: [
          "BlooDoc organises blood donation camps and runs the sign-up, the roster and the follow-up for them. Registering is free.",
        ],
      },
      {
        heading: "What this is not",
        body: [
          "BlooDoc is not a medical provider, a hospital or a blood bank. It gives no medical advice, holds no blood and supplies none.",
          "Nothing on this site clears you to donate. Eligibility is decided by the medical officer at the camp, after screening, on the day. Registering does not guarantee you will be able to donate.",
        ],
      },
      {
        heading: "What you agree to",
        body: [
          "That the details you give are true, as far as you know. A wrong answer about medication or recent illness is not a formality — it is a risk to the person who receives your blood.",
          "That you will tell the desk on the day if anything has changed since you registered.",
          "That we may contact you about camps at the address and number you gave.",
        ],
      },
      {
        heading: "Cancelling",
        body: [
          "Not turning up costs you nothing and nobody will chase you. Tell us if you can, so the place goes to somebody else.",
        ],
      },
    ],
  },
  {
    slug: "data",
    title: "How we handle health data",
    updated: "2026-09-21",
    summary: "The specific commitments we make about the medical part of your record.",
    sections: [
      {
        heading: "It is treated as sensitive",
        body: [
          "Your blood group, blood pressure, weight, medication and any deferral reason are health data. They are visible only to the people running the camps, and never to another donor.",
        ],
      },
      {
        heading: "It is refused at the database, not filtered by the app",
        body: [
          "Every table has row-level security enabled with explicit policies. A donor's session can read that donor's rows and no others — not because the application asks nicely, but because Postgres refuses the query. An application bug cannot widen that.",
          "Sign-in codes are stored only as a SHA-256 hash, and the table holding them has security enabled with no policies at all: no browser session can reach it under any circumstance.",
        ],
      },
      {
        heading: "It is not used for anything else",
        body: [
          "It is not profiled, scored, sold or shared. The console's assistant can read it to answer an organiser's question, and it runs under that organiser's own permissions — it cannot reach a record they could not open themselves.",
        ],
      },
      {
        heading: "Deferrals are kept, not hidden",
        body: [
          "If you are turned away, the reason is recorded so the next camp knows whether it still applies. It is not a mark against you, and it is visible to you on your own page.",
        ],
      },
    ],
  },
];

export const getLegalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
