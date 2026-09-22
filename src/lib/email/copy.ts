import "server-only";

import { cache } from "react";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

/**
 * Admin-editable copy for the transactional emails.
 *
 * Three fields per template — subject, heading, lead — substituted with
 * `{{token}}` values and falling back to the built-in wording whenever a field
 * is blank. The layout, the branding and every block that carries data stay in
 * templates.ts where they cannot be broken from a form.
 */

export type TemplateKey =
  | "signin_code"
  | "registration_confirmed"
  | "camp_reminder"
  | "profile_change";

export type TemplateCopy = { subject?: string; heading?: string; lead?: string };

/**
 * What each template is, and which tokens it can use.
 *
 * The console reads this to build the editor, so a token that exists in code
 * and not here is one nobody can discover — which is why the list lives beside
 * the substitution rather than in a help page.
 */
export const TEMPLATE_META: Record<
  TemplateKey,
  { label: string; description: string; tokens: { token: string; means: string }[] }
> = {
  signin_code: {
    label: "Sign-in code",
    description:
      "Sent every time somebody asks for a code. The code block itself is fixed — only the wording around it can change.",
    tokens: [
      { token: "{{code}}", means: "The six-digit code" },
      { token: "{{minutes}}", means: "How long it stays valid" },
    ],
  },
  registration_confirmed: {
    label: "Registration confirmed",
    description: "Sent the moment somebody completes the form for a camp.",
    tokens: [
      { token: "{{name}}", means: "The donor's first name" },
      { token: "{{camp}}", means: "The camp's title" },
      { token: "{{when}}", means: "Date and time" },
      { token: "{{venue}}", means: "Where it is" },
      { token: "{{group}}", means: "Their blood group" },
    ],
  },
  profile_change: {
    label: "Profile change confirmation",
    description:
      "Sent when a donor edits their own record. The code block is fixed — only the wording around it can change.",
    tokens: [
      { token: "{{code}}", means: "The six-digit code" },
      { token: "{{minutes}}", means: "How long it stays valid" },
    ],
  },
  camp_reminder: {
    label: "Camp reminder",
    description: "Sent from the console to everybody on a roster.",
    tokens: [
      { token: "{{name}}", means: "The donor's first name" },
      { token: "{{camp}}", means: "The camp's title" },
      { token: "{{when}}", means: "Date and time" },
      { token: "{{venue}}", means: "Where it is" },
    ],
  },
};

/**
 * Replace `{{token}}` with its value.
 *
 * Case- and space-insensitive, because the tokens are typed by hand into a
 * form and `{{ Name }}` is the same intent as `{{name}}`. An unknown token is
 * left exactly as written rather than blanked — a visible `{{camp}}` in a test
 * send tells the author they typed it wrong; an empty gap does not.
 */
export function fillTokens(text: string, values: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) => {
    const v = values[name.toLowerCase()];
    return v == null || v === "" ? whole : String(v);
  });
}

/**
 * Every override, as one map.
 *
 * `cache` dedupes within a render pass, and the read is best-effort: an email
 * must still send if this table is unreachable or does not exist yet, so a
 * failure returns no overrides rather than throwing. That is also what makes
 * the whole feature safe to deploy before 0012 has been pushed.
 */
export const getTemplateCopy = cache(
  async (): Promise<Partial<Record<TemplateKey, TemplateCopy>>> => {
    if (!adminConfigured()) return {};
    try {
      const { data, error } = await createAdminClient()
        .from("email_templates")
        .select("key, subject, heading, lead");
      if (error || !data) return {};
      const out: Partial<Record<TemplateKey, TemplateCopy>> = {};
      for (const row of data as { key: string; subject: string | null; heading: string | null; lead: string | null }[]) {
        out[row.key as TemplateKey] = {
          subject: row.subject?.trim() || undefined,
          heading: row.heading?.trim() || undefined,
          lead: row.lead?.trim() || undefined,
        };
      }
      return out;
    } catch {
      return {};
    }
  },
);

/** One template's overrides, already token-substituted. */
export async function copyFor(
  key: TemplateKey,
  values: Record<string, string | null | undefined>,
): Promise<TemplateCopy> {
  const all = await getTemplateCopy();
  const c = all[key];
  if (!c) return {};
  return {
    subject: c.subject ? fillTokens(c.subject, values) : undefined,
    heading: c.heading ? fillTokens(c.heading, values) : undefined,
    lead: c.lead ? fillTokens(c.lead, values) : undefined,
  };
}
