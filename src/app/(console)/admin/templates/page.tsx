import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shell/page-header";
import { TemplateEditor } from "@/components/admin/template-editor";
import { TEMPLATE_META, fillTokens, type TemplateKey } from "@/lib/email/copy";
import {
  campReminderEmail,
  profileChangeCodeEmail,
  registrationConfirmedEmail,
  signInCodeEmail,
} from "@/lib/email/templates";
import type { EmailTemplate } from "@/lib/db/types";

export const metadata: Metadata = { title: "Email templates" };

/**
 * Sample values for the previews.
 *
 * Obviously fake on purpose — "Ankit Sharma" and a 000000 code rather than a
 * real donor pulled from the table. A preview that renders a real person's
 * name is a preview that leaks one every time an administrator opens this page
 * to fix a typo.
 */
const SAMPLE = {
  code: "482913",
  minutes: "5",
  name: "Ankit",
  camp: "Mega Blood Donation Drive Camp 2026",
  when: "Friday, 25 September 2026, 11:00 am – 4:00 pm",
  venue: "The Royal Global University, DEF Block 6th Floor, Guwahati",
  group: "O+",
};

/** Render one template exactly as it would be sent, with the saved copy. */
function renderPreview(key: TemplateKey, saved: EmailTemplate | undefined) {
  const copy = {
    subject: saved?.subject ? fillTokens(saved.subject, SAMPLE) : undefined,
    heading: saved?.heading ? fillTokens(saved.heading, SAMPLE) : undefined,
    lead: saved?.lead ? fillTokens(saved.lead, SAMPLE) : undefined,
  };

  switch (key) {
    case "signin_code":
      return signInCodeEmail(SAMPLE.code, Number(SAMPLE.minutes), copy);
    case "registration_confirmed":
      return registrationConfirmedEmail(
        {
          donorName: SAMPLE.name,
          campTitle: SAMPLE.camp,
          when: SAMPLE.when,
          venue: SAMPLE.venue,
          bloodGroup: SAMPLE.group,
          collaboration: "Terapanth Yuvak Parishad, Guwahati",
          partner: "State of the Art Model Blood Centre, Gauhati Medical College & Hospital",
        },
        copy,
      );
    case "profile_change":
      return profileChangeCodeEmail(SAMPLE.code, Number(SAMPLE.minutes), copy);
    case "camp_reminder":
      return campReminderEmail(
        {
          donorName: SAMPLE.name,
          campTitle: SAMPLE.camp,
          when: SAMPLE.when,
          venue: SAMPLE.venue,
        },
        copy,
      );
  }
}

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("email_templates").select("*");
  const saved = new Map(((data ?? []) as EmailTemplate[]).map((r) => [r.key, r]));

  const keys = Object.keys(TEMPLATE_META) as TemplateKey[];

  return (
    <>
      <PageHeader
        title="Email templates"
        subtitle="The wording of the messages the site sends. Leave a field blank to keep the built-in text."
      />

      <div className="flex flex-col gap-5">
        {keys.map((key) => {
          const meta = TEMPLATE_META[key];
          const row = saved.get(key);
          const preview = renderPreview(key, row);
          return (
            <TemplateEditor
              key={key}
              templateKey={key}
              label={meta.label}
              description={meta.description}
              tokens={meta.tokens}
              current={
                row ? { subject: row.subject, heading: row.heading, lead: row.lead } : null
              }
              previewHtml={preview.html}
              previewSubject={preview.subject}
              updatedAt={row?.updated_at ?? null}
            />
          );
        })}
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        The layout, the logo and the blocks that carry data — the sign-in code
        itself, the camp card, the eligibility note — are fixed. Only the
        subject, the heading and the opening paragraph can be edited here, so a
        mistyped tag can never break an email that is already on its way.
      </p>
    </>
  );
}
