import "server-only";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";

// The only place in the app that talks to the mail provider. Everything else
// renders HTML and hands it here, so there is one place to swap providers and
// one place that knows what a send failure looks like.

const API_URL = process.env.ZEPTOMAIL_API_URL ?? "https://api.zeptomail.in/v1.1/email";
const TOKEN = process.env.ZEPTOMAIL_TOKEN; // "Zoho-enczapikey <send-mail-token>"
const FROM = process.env.MAIL_FROM ?? "noreply@bloodoc.life";
const FROM_NAME = process.env.MAIL_FROM_NAME ?? "BlooDoc";

export type SendEmailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  replyTo?: string | null;
  /** Which template produced this, for the log. */
  template?: string | null;
};

export type SendEmailResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

/** True when the mailer is configured — callers can degrade rather than fail. */
export function emailConfigured(): boolean {
  return !!TOKEN;
}

/**
 * Send one email through the ZeptoMail HTTP API. Never throws.
 *
 * Every attempt is written to `email_log`, successes included. A log that only
 * records failures cannot answer "did the code actually go out", which is the
 * question someone asks while a donor is on the phone.
 */
export async function sendEmailNow(input: SendEmailInput): Promise<SendEmailResult> {
  const result = await deliver(input);
  await log(input, result);
  return result;
}

async function deliver(input: SendEmailInput): Promise<SendEmailResult> {
  if (!TOKEN) return { ok: false, error: "Email is not configured (ZEPTOMAIL_TOKEN)." };
  if (!input.to.includes("@")) return { ok: false, error: "Invalid recipient address." };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: TOKEN,
      },
      body: JSON.stringify({
        from: { address: FROM, name: FROM_NAME },
        to: [{ email_address: { address: input.to, name: input.toName || input.to } }],
        ...(input.replyTo ? { reply_to: [{ address: input.replyTo, name: FROM_NAME }] } : {}),
        subject: input.subject,
        htmlbody: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `ZeptoMail ${res.status}: ${body.slice(0, 300)}` };
    }

    const data = (await res.json().catch(() => null)) as
      | { data?: Array<{ message_id?: string }>; request_id?: string }
      | null;
    return { ok: true, providerId: data?.data?.[0]?.message_id ?? data?.request_id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error." };
  }
}

/** Best-effort. A logging failure must never turn a delivered email into an error. */
async function log(input: SendEmailInput, result: SendEmailResult) {
  if (!adminConfigured()) return;
  try {
    await createAdminClient().from("email_log").insert({
      to_email: input.to,
      subject: input.subject,
      template: input.template ?? null,
      ok: result.ok,
      provider_id: result.ok ? result.providerId : null,
      error: result.ok ? null : result.error,
    });
  } catch {
    /* ignore */
  }
}
