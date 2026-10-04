"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeOtp, issueOtp, normaliseEmail, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { signInCodeEmail, signInAlertEmail } from "@/lib/email/templates";
import { firstIp, getLoginContext } from "@/lib/email/login-context";
import { copyFor } from "@/lib/email/copy";
import { sendWhatsAppSignInCode, whatsappConfigured } from "@/lib/whatsapp/send";

export type AuthState = {
  error?: string;
  sent?: boolean;
  email?: string;
  /**
   * Changes on every successful send. Not a timestamp anybody measures with —
   * the client uses it only as an identity, to know a *new* code went out and
   * restart its own countdown. The cooldown that actually matters is enforced
   * in `issueOtp`.
   */
  sentAt?: number;
  /** Set instead of `email` on the phone sign-in path. */
  phone?: string;
};

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

/**
 * Step one: mail a code.
 *
 * Any address may sign in. There used to be a gate here refusing addresses
 * with no donor record, partner invite or profile, which meant somebody who
 * had not registered yet was turned away with nowhere to go. Now they sign in,
 * land on the panel with an empty record, and apply to a camp from there — the
 * registration is what creates the donor row, exactly as it does signed out.
 *
 * A side effect worth keeping: the form answers identically for every address
 * again, so it can no longer be used to test whether someone has registered.
 *
 * What stops it being used to mail strangers is the per-IP and per-address
 * hourly cap in `issueOtp`. A cooldown hit still reports success; it leaks
 * nothing.
 */
export async function requestSignInCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;

  if (!emailConfigured()) {
    return { error: "Email is not configured yet. Ask an administrator to set ZEPTOMAIL_TOKEN." };
  }

  const ip = firstIp(await headers());
  const issued = await issueOtp(email, "signin", ip);
  if (issued.status === "limited") {
    return { error: "Too many tries. Try again later." };
  }
  if (issued.status === "error") {
    return { error: "Couldn't send a code. Try again." };
  }
  if (issued.status === "issued") {
    const copy = await copyFor("signin_code", {
      code: issued.code,
      minutes: String(OTP_TTL_MINUTES),
    });
    const { subject, html } = signInCodeEmail(issued.code, OTP_TTL_MINUTES, copy);
    const sent = await sendEmailNow({ to: email, subject, html, template: "signin-code" });
    if (!sent.ok) return { error: "Couldn't send the email. Try again." };
  }

  return { sent: true, email, sentAt: Date.now() };
}

/**
 * Step two: check the code, then mint a real Supabase session.
 *
 * The session is not ours to fake. Once the code checks out we ask GoTrue for a
 * one-time token for that address — `magiclink` for someone who already exists,
 * `signup` for someone who does not — and immediately exchange it for the
 * session cookie. `generateLink` does not send anything itself, which is the
 * whole point: the code the donor typed came from ZeptoMail with our branding
 * on it, and Supabase's own mailer is never involved.
 */
export async function verifySignInCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!parsed.success) return { error: "Invalid email. Start again." };
  if (code.length !== 6) return { error: "Enter the 6-digit code.", sent: true, email: parsed.data };

  const email = parsed.data;
  const ok = await consumeOtp(email, code);
  if (!ok) {
    return { error: "Wrong or expired code.", sent: true, email };
  }

  const session = await startSession(email);
  if ("error" in session) return { error: session.error, sent: true, email };
  return finishSignIn(email, session.supabase);
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Mint a real Supabase session for an address whose owner has just proved
 * control of it, or of the phone on its donor record. Returns the client now
 * holding that session (its cookie is set), or an error message.
 */
async function startSession(
  email: string,
): Promise<{ supabase: SessionClient } | { error: string }> {
  const admin = createAdminClient();

  // Make sure a *confirmed* account exists, then mint a magiclink against it.
  //
  // This used to ask for a magiclink and, when that errored because the account
  // did not exist yet, fall back to `generateLink({ type: "signup" })`. That
  // fallback is what broke sign-in in production. A signup link creates the
  // user immediately but leaves `email_confirmed_at` null until its token is
  // exchanged — so when the exchange failed for any reason, it left behind a
  // half-made account, and every later attempt inherited it. Two of the
  // project's own addresses ended up in exactly that state.
  //
  // Creating the user explicitly with `email_confirm: true` removes the second
  // kind of link and the second kind of account. Marking the address confirmed
  // is honest here and not a shortcut: we only reach this line because the
  // donor read a six-digit code out of that inbox and typed it back, which is a
  // stronger proof of control than clicking a link in it.
  let link = await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (link.error) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      // Required by the API and used by nothing: sign-in is the code, every
      // time. Random, so no shared default exists to try against every account.
      password: randomBytes(32).toString("base64url"),
    });
    if (created.error) {
      // Logged, not shown. The donor can do nothing with a GoTrue message, but
      // without this in the server log the failure is invisible — which is
      // precisely why the original outage took a database inspection to find.
      console.error("[signin] createUser failed", created.error);
      return { error: "Sign-in failed. Try again." };
    }
    link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }

  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.error("[signin] generateLink failed", link.error);
    return { error: "Sign-in failed. Try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) {
    console.error("[signin] verifyOtp failed", error);
    return { error: "Sign-in failed. Try again." };
  }
  return { supabase };
}

/** After the session exists: the sign-in alert, then the right landing page. */
async function finishSignIn(email: string, supabase: SessionClient): Promise<never> {
  // Tell them it happened.
  //
  // Best-effort and deliberately not awaited for its result: a mail outage
  // must never turn a successful sign-in into a failure. Sent after every
  // sign-in rather than only unrecognised ones — see the template for why.
  if (emailConfigured()) {
    try {
      const ctx = await getLoginContext();
      const alertCopy = await copyFor("signin_alert", {
        device: ctx.device,
        location: ctx.location,
        time: ctx.time,
      });
      const alert = signInAlertEmail(ctx, alertCopy);
      await sendEmailNow({
        to: email,
        subject: alert.subject,
        html: alert.html,
        template: "signin-alert",
      });
    } catch (e) {
      console.error("[signin] alert email failed", e);
    }
  }

  // Where they land depends on who they are, and the profile row exists by now
  // (the auth.users trigger writes it). Redirect throws, so nothing follows.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();

  redirect(
    profile?.role === "admin"
      ? "/admin"
      : profile?.role === "verifier"
        ? "/desk"
        : "/dashboard",
  );
}

// --------------------------------------------------------------------------
// Sign in with a phone number.
//
// The code goes to WhatsApp instead of the inbox, and is checked exactly as an
// emailed one is — same table, same hashing, same expiry, attempt and hourly
// limits — under the email of the donor record that carries that number. The
// session that results is that address's account, so a donor who signs in by
// phone and one who signs in by email land on the same record.
//
// A number matches only when it belongs to exactly one donor address. A
// family sharing one phone across two records cannot use it: picking one of
// them would sign somebody into another person's account. They still have
// email.
// --------------------------------------------------------------------------

/** "98765 43210", "+91 98765-43210" → "9876543210", or null. */
function normalisePhone(raw: FormDataEntryValue | null): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** The one donor address on this number, or null for none or several. */
async function emailForPhone(phone: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("donors").select("email").eq("phone", phone).limit(5);
  const emails = [...new Set((data ?? []).map((d) => normaliseEmail(d.email)))];
  return emails.length === 1 ? emails[0] : null;
}

export async function requestPhoneCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const phone = normalisePhone(formData.get("phone"));
  if (!phone) return { error: "Enter your 10-digit mobile number." };
  if (!whatsappConfigured()) {
    return { error: "Phone sign-in is not available yet. Use your email." };
  }

  const email = await emailForPhone(phone);
  // No record, or more than one, sends nothing but answers the same way as a
  // success, so this form cannot be used to find out whose number is whose.
  if (email) {
    const ip = firstIp(await headers());
    const issued = await issueOtp(email, "phone_signin", ip);
    if (issued.status === "limited") return { error: "Too many tries. Try again later." };
    if (issued.status === "error") return { error: "Couldn't send a code. Try again." };
    if (issued.status === "issued") {
      const sent = await sendWhatsAppSignInCode(phone, issued.code);
      if (!sent.ok) return { error: "Couldn't send the WhatsApp message. Try again, or use your email." };
    }
  }

  return { sent: true, phone, sentAt: Date.now() };
}

export async function verifyPhoneCode(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const phone = normalisePhone(formData.get("phone"));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!phone) return { error: "Invalid number. Start again." };
  if (code.length !== 6) return { error: "Enter the 6-digit code.", sent: true, phone };

  const email = await emailForPhone(phone);
  if (!email || !(await consumeOtp(email, code, "phone_signin"))) {
    return { error: "Wrong or expired code.", sent: true, phone };
  }

  const session = await startSession(email);
  if ("error" in session) return { error: session.error, sent: true, phone };
  return finishSignIn(email, session.supabase);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Exported for the console's "email a donor a sign-in link" affordance. */
export async function normalise(email: string) {
  return normaliseEmail(email);
}
