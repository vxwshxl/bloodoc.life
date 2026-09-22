/**
 * What each console page is, in the assistant's words.
 *
 * Plain data with no `"use client"` and no `server-only`, because both sides
 * need it: the client sends the pathname it is on, the server turns that into
 * the paragraph below and puts it in the system prompt. (Keeping it importable
 * from either side is the same rule that `lib/roles.ts` exists for — a value
 * exported from a client module arrives in a Server Component as a proxy, and
 * the failure is silent.)
 *
 * `audit` names the tables that page writes to, which is what lets "what
 * changed here?" be answered from `audit_log` rather than guessed. A page with
 * no `audit` is one that only reads.
 *
 * This is documentation, not permission. Telling the model what the Donors page
 * is for does not let it read a donor — every tool still runs on the caller's
 * own session, and RLS answers.
 */
export type PageKnowledge = {
  /** What it is called in the sidebar. */
  title: string;
  /** One or two sentences: what this page is for and what is on it. */
  about: string;
  /** Things a person can actually do here, so the model stops inventing others. */
  actions?: string[];
  /** Tables whose `audit_log` rows are this page's history. */
  audit?: string[];
};

/**
 * Exact paths first, then prefixes. A dynamic segment (`/admin/partners/nss`)
 * has no entry of its own and falls back to its parent, which is the right
 * answer — one partner's page is the partners page with a filter on it.
 */
export const PAGES: Record<string, PageKnowledge> = {
  "/admin": {
    title: "Overview",
    about:
      "The console's front page. Headline counts for donors, camps and registrations, charts of donors by blood group and registrations over time, and the next camp with how full it is.",
    actions: ["Open any camp or list from the tiles"],
  },
  "/admin/camps": {
    title: "Camps",
    about:
      "Every camp, draft and published. A camp carries its date, venue, capacity, the partners running it, whether it is listed publicly and whether it is the one featured on the home page.",
    actions: [
      "Create or edit a camp",
      "Publish, close, list or unlist it",
      "Make one camp the featured camp on the home page",
    ],
    audit: ["camps", "camp_partners"],
  },
  "/admin/registrations": {
    title: "Registrations",
    about:
      "The roster: everybody who signed up for a camp, with their screening record and outcome. Status runs registered → screened → donated, or deferred or cancelled. Vitals belong to the registration, not the donor, because they are a snapshot of one day.",
    actions: [
      "Change a registration's status",
      "Record a deferral and its reason",
      "Filter by camp, status or blood group",
    ],
    audit: ["registrations"],
  },
  "/admin/donors": {
    title: "Donors",
    about:
      "One row per person, keyed on email. Blood group, contact details, department, and how many times they say they had donated before BlooDoc. A donor with no account is a walk-in entered from a paper slip.",
    actions: ["Search donors", "Open a donor to see their registrations"],
    audit: ["donors"],
  },
  "/admin/users": {
    title: "Users",
    about:
      "Every account that can sign in, with its role. Role is read from the database on every request, so a change takes effect on that person's next click rather than when their token expires.",
    actions: [
      "Change somebody's role",
      "Open an account to see its donor record and partner access",
      "View the console as that person",
    ],
    audit: ["profiles"],
  },
  "/admin/roles": {
    title: "Roles",
    about:
      "A read-only description of what each role can do: administrator, verifier, partner member, donor. Roles are fixed in the database schema — this page explains them, it does not edit them.",
  },
  "/admin/partners": {
    title: "Partners",
    about:
      "The organisations and blood banks that run camps with us. An organisation brings the donors; a blood bank receives the units and is the only kind that may record a screening result or a donation.",
    actions: ["Add a partner", "Invite a member by email", "Attach a partner to a camp"],
    audit: ["partners", "partner_members", "camp_partners"],
  },
  "/admin/certificates": {
    title: "Certificates",
    about:
      "One certificate per donation, minted pending the moment a registration reaches 'donated'. It is only valid once a human approves it. The code (BD-2026-XXXXXX) is what anybody can type into /verify.",
    actions: ["Approve a pending certificate", "Revoke one, with a reason"],
    audit: ["certificates"],
  },
  "/admin/email": {
    title: "Email",
    about:
      "Everything the site has sent, newest first: who it went to, which template, whether the provider accepted it, and the body exactly as sent. Opening a row previews that body in a sandboxed frame.",
    actions: ["Preview a sent email", "Delete a log row"],
  },
  "/admin/templates": {
    title: "Email templates",
    about:
      "The editable wording of the transactional emails — subject, heading and opening line. The layout is not editable, on purpose: these carry sign-in codes, and a broken template is a donor who cannot get in. A blank field falls back to the wording in the code.",
    actions: ["Edit a template's subject, heading or opening line"],
    audit: ["email_templates"],
  },
  "/admin/audit": {
    title: "Audit",
    about:
      "Every change to the records, written by a database trigger rather than by the app, and readable by administrators only. An update records just the columns that changed, as from → to.",
  },
  "/admin/assistant": {
    title: "Assistant",
    about: "This assistant, on its own page instead of in the side panel.",
  },

  "/desk": {
    title: "Desk",
    about:
      "The verifier's view. A verifier reads the roster and records screening and donation outcomes, and can do nothing else — no donor list, no camps, no accounts.",
    actions: ["Record a screening result", "Mark a donation or a deferral"],
    audit: ["registrations"],
  },
  "/desk/roster": {
    title: "Roster",
    about: "The people expected at a camp today, in the order they registered, with their outcome so far.",
    actions: ["Record an outcome against a person"],
    audit: ["registrations"],
  },

  "/partner": {
    title: "Partner overview",
    about:
      "What this partner's own camps look like: how many registered, how many turned up and how many donated. A partner sees the camps it is attached to and nothing else.",
  },
  "/partner/camps": {
    title: "Our camps",
    about: "The camps this partner is attached to, with dates, venues and registration counts.",
  },
  "/partner/registrations": {
    title: "Our registrations",
    about:
      "The roster for this partner's camps. A blood bank may record screening and donation outcomes here; an organisation may only read.",
    audit: ["registrations"],
  },
  "/partner/certificates": {
    title: "Our certificates",
    about: "Certificates from this partner's camps, and whether each one has been approved.",
  },

  "/dashboard": {
    title: "Your dashboard",
    about:
      "The donor's own console. Their next camp, their donation history, and their certificates — their own records only.",
  },
  "/dashboard/applications": {
    title: "Your registrations",
    about: "Every camp this donor has registered for and what happened at each one.",
  },
  "/dashboard/certificates": {
    title: "Your certificates",
    about:
      "Certificates for this donor's donations. A certificate is valid once it has been approved; the code on it can be checked by anybody at /verify.",
  },
  "/dashboard/profile": {
    title: "Your profile",
    about:
      "The donor's own details — name, phone, department, blood group. The email address cannot be changed here, because it is the sign-in.",
    audit: ["donors"],
  },
};

/**
 * The entry for a path, falling back to the longest matching parent.
 *
 * `/admin/partners/nss-rgu` has no entry of its own and resolves to
 * `/admin/partners`, which is accurate rather than a compromise: one partner's
 * page is the partners page with a filter on it.
 */
export function pageKnowledge(pathname: string | null | undefined): PageKnowledge | null {
  if (!pathname) return null;
  const path = pathname.replace(/\/+$/, "") || "/";
  if (PAGES[path]) return PAGES[path];

  let best: string | null = null;
  for (const key of Object.keys(PAGES)) {
    if (path.startsWith(`${key}/`) && (!best || key.length > best.length)) best = key;
  }
  return best ? PAGES[best] : null;
}

/** The paragraph that goes into the system prompt. */
export function pageBrief(pathname: string | null | undefined): string | null {
  const page = pageKnowledge(pathname);
  if (!page) return null;
  const lines = [
    `The person is looking at the ${page.title} page (${pathname}) right now.`,
    page.about,
  ];
  if (page.actions?.length) lines.push(`From here they can: ${page.actions.join("; ")}.`);
  if (page.audit?.length) {
    lines.push(
      `If they ask what changed on this page, call recent_changes with table set to one of: ${page.audit.join(", ")}.`,
    );
  }
  lines.push(
    'Answer "what is this page" and "what changed" from this, without calling a tool for the description itself.',
  );
  return lines.join(" ");
}
