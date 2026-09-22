"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeOtp, issueOtp, normaliseEmail, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { signInCodeEmail } from "@/lib/email/templates";
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
 * Addresses that are always administrators.
 *
 * Kept in sync by hand with `official_admins` in migration 0009, which is what
 * actually assigns the role. This copy exists so the same addresses can also
 * skip the "have you registered" check below — they never will have.
 *
 * Lowercase, because `emailSchema` has already lowercased whatever was typed.
 */
const OFFICIAL_ADMIN_EMAILS = ["bloodoclife@gmail.com", "hello@bloodoc.life"];

/**
 * May this address be sent a code at all?
 *
 * Four ways in, checked in the order they are cheapest to disprove:
 *
 *  - Nobody has ever signed in. The first account bootstraps the administrator
 *    (see 0009), so it cannot require a prior record — there is nothing to have
 *    registered against yet.
 *  - A profile already exists. Somebody who is already in stays in, whatever
 *    their donor record looks like now.
 *  - A donor record exists. This is the ordinary route: you filled the camp
 *    form, so the email you used is the account.
 *  - A partner invite exists. Blood bank and organisation staff are not donors
 *    and would otherwise be locked out of the panel they were invited to.
 */
async function signInEligibility(
  email: string,
): Promise<{ allowed: true } | { allowed: false }> {
  // The project's own mailboxes are always let through, and the signup trigger
  // makes them admin. Without this they would be refused on their very first
  // sign-in — they have no donor record and no invite, because they are the
  // people who hand those out.
  if (OFFICIAL_ADMIN_EMAILS.includes(email)) return { allowed: true };

  const admin = createAdminClient();

  const { count: profileCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if ((profileCount ?? 0) === 0) return { allowed: true };

  const [profile, donor, member] = await Promise.all([
    admin.from("profiles").select("id").eq("email", email).limit(1).maybeSingle(),
    admin.from("donors").select("id").eq("email", email).limit(1).maybeSingle(),
    admin.from("partner_members").select("id").eq("email", email).limit(1).maybeSingle(),
  ]);

  return profile.data || donor.data || member.data ? { allowed: true } : { allowed: false };
}

/**
 * Step one: mail a code.
 *
 * This used to answer identically whether or not the address belonged to
 * anyone, so the form could not be used to test whether a given person had
 * registered. That is no longer true, and the trade is worth stating plainly:
 * sign-in is now restricted to people who already have a donor record, a
 * partner invite or an account, and telling an unknown address to go and
 * register is precisely what makes this page usable by a student who mistyped
 * their email. The cost is that the form will confirm whether an address is
 * known to the site. On a register of blood donors that is real, not
 * theoretical, and the mitigation is the rate limit below rather than silence.
 *
 * A cooldown hit still reports success, because that one leaks nothing an
 * attacker could not already learn from the eligibility check above.
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

  // Registering for a camp is what creates the account. There is no separate
  // sign-up, so an address nobody has ever registered with has nothing to sign
  // in to, and sending it a code would only produce a working session attached
  // to an empty profile.
  const eligible = await signInEligibility(email);
  if (!eligible.allowed) {
    return {
      error:
        "No registration found for this email. Register for a camp first — the email you use there becomes your sign-in.",
    };
  }

  const issued = await issueOtp(email);
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

  // Where they land depends on who they are, and the profile row exists by now
  // (the auth.users trigger writes it). Redirect throws, so nothing follows.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();

  redirect(profile?.role === "admin" ? "/admin" : "/me");
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
