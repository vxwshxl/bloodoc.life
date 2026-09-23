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
    return { error: "Too many codes requested. Wait a while and try again." };
  }
  if (issued.status === "error") {
    return { error: "Could not send a code right now. Try again in a moment." };
  }
  if (issued.status === "issued") {
    const copy = await copyFor("signin_code", {
      code: issued.code,
      minutes: String(OTP_TTL_MINUTES),
    });
    const { subject, html } = signInCodeEmail(issued.code, OTP_TTL_MINUTES, copy);
    const sent = await sendEmailNow({ to: email, subject, html, template: "signin-code" });
    if (!sent.ok) return { error: "Could not send the email. Try again in a moment." };
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
  if (!parsed.success) return { error: "Start again. That email address is not valid." };
  if (code.length !== 6) return { error: "Enter the six digits from the email.", sent: true, email: parsed.data };

  const email = parsed.data;
  const ok = await consumeOtp(email, code);
  if (!ok) {
    return { error: "That code is wrong or has expired. Send a new one.", sent: true, email };
  }

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
      return { error: "Could not complete sign-in. Try again in a moment.", sent: true, email };
    }
    link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  }

  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    console.error("[signin] generateLink failed", link.error);
    return { error: "Could not complete sign-in. Try again in a moment.", sent: true, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) {
    console.error("[signin] verifyOtp failed", error);
    return { error: "Could not complete sign-in. Try again in a moment.", sent: true, email };
  }

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Exported for the console's "email a donor a sign-in link" affordance. */
export async function normalise(email: string) {
  return normaliseEmail(email);
}
