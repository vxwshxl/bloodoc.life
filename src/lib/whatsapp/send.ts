import "server-only";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

/**
 * WhatsApp, through Meta's WhatsApp Business Cloud API.
 *
 * The only place in the app that talks to WhatsApp, the way lib/email/send.ts
 * is the only place that talks to ZeptoMail. Two messages go out on it: the
 * sign-in code for phone sign-in, and the certificate once a donation is
 * recorded.
 *
 * WhatsApp only lets a business start a conversation with a pre-approved
 * template, so both are templates, created and approved in Meta's WhatsApp
 * Manager under the names below (overridable by env):
 *
 *   bloodoc_signin_code  — category Authentication, "Copy code" button. Meta
 *                          writes the body itself; it takes the code as {{1}}.
 *   bloodoc_certificate  — category Utility. Body:
 *       "Hi {{1}}, thank you for donating blood at {{2}} on {{3}}. Your
 *        certificate number is {{4}}. Download it from the link below."
 *     with one URL button, "View certificate", whose URL is
 *       https://bloodoc.life/verify/{{1}}
 *
 * Read from the environment on every call, like the assistant's key, so a
 * token rotated in the dashboard takes effect without a redeploy. Left unset,
 * `whatsappConfigured()` is false and every caller skips this channel.
 */

function config() {
  const token = process.env.WHATSAPP_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  return {
    token,
    phoneNumberId,
    configured: token.length > 0 && phoneNumberId.length > 0,
    version: process.env.WHATSAPP_API_VERSION?.trim() || "v21.0",
    lang: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en",
    signinTemplate: process.env.WHATSAPP_SIGNIN_TEMPLATE?.trim() || "bloodoc_signin_code",
    certificateTemplate: process.env.WHATSAPP_CERTIFICATE_TEMPLATE?.trim() || "bloodoc_certificate",
  };
}

export function whatsappConfigured(): boolean {
  return config().configured;
}

/** A stored 10-digit Indian mobile number → the international form WhatsApp wants. */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return null;
}

type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

type Component =
  | { type: "body"; parameters: { type: "text"; text: string }[] }
  | { type: "button"; sub_type: "url"; index: string; parameters: { type: "text"; text: string }[] };

async function sendTemplate(input: {
  phone: string;
  template: string;
  components: Component[];
  /** For the log: what this message was. */
  label: string;
  logTemplate: string;
}): Promise<SendResult> {
  const c = config();
  const to = toWhatsAppNumber(input.phone);
  let result: SendResult;
  if (!c.configured) {
    result = { ok: false, error: "WhatsApp is not configured (WHATSAPP_TOKEN)." };
  } else if (!to) {
    result = { ok: false, error: "Not a valid Indian mobile number." };
  } else {
    try {
      const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: { name: input.template, language: { code: c.lang }, components: input.components },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        result = { ok: false, error: `WhatsApp ${res.status}: ${body.slice(0, 300)}` };
      } else {
        const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
        result = { ok: true, id: data?.messages?.[0]?.id ?? null };
      }
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : "Network error." };
    }
  }
  await log(input, to, result);
  return result;
}

/**
 * Into the same `email_log` the console already reads, marked as WhatsApp in
 * the recipient and the template, so "did the donor get it" has one answer
 * page rather than two. Best-effort, like the email log.
 */
async function log(input: { label: string; logTemplate: string }, to: string | null, result: SendResult) {
  if (!adminConfigured()) return;
  try {
    await createAdminClient().from("email_log").insert({
      to_email: `WhatsApp +${to ?? "?"}`,
      subject: input.label,
      template: input.logTemplate,
      ok: result.ok,
      provider_id: result.ok ? result.id : null,
      error: result.ok ? null : result.error,
      html: null,
    });
  } catch {
    /* ignore */
  }
}

/** The six-digit sign-in code, as an Authentication template. */
export function sendWhatsAppSignInCode(phone: string, code: string) {
  return sendTemplate({
    phone,
    template: config().signinTemplate,
    components: [
      { type: "body", parameters: [{ type: "text", text: code }] },
      // The "Copy code" button carries the code as well.
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
    ],
    // Never the code itself: the log is readable in the console.
    label: "Sign-in code",
    logTemplate: "whatsapp-signin-code",
  });
}

/** The certificate, with a button to the page that shows and downloads it. */
export function sendWhatsAppCertificate(input: {
  phone: string;
  firstName: string;
  campTitle: string;
  campDate: string;
  code: string;
}) {
  return sendTemplate({
    phone: input.phone,
    template: config().certificateTemplate,
    components: [
      {
        type: "body",
        parameters: [input.firstName, input.campTitle, input.campDate, input.code].map((text) => ({
          type: "text" as const,
          text,
        })),
      },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.code }] },
    ],
    label: `Certificate ${input.code} — ${input.campTitle}`,
    logTemplate: "whatsapp-certificate",
  });
}
