"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeOtp, issueOtp, normaliseEmail, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { signInCodeEmail } from "@/lib/email/templates";

export type AuthState = { error?: string; sent?: boolean; email?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

/**
 * Step one: mail a code.
 *
 * The response is deliberately the same whether or not the address belongs to
 * anyone — "no account with that email" is a free account-existence oracle, and
 * on a site whose user list is people's medical eligibility that is not a
 * detail to leak. A cooldown hit reports success for the same reason.
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

  const issued = await issueOtp(email);
  if (issued.status === "error") {
    return { error: "Could not send a code right now. Try again in a moment." };
  }
  if (issued.status === "issued") {
    const { subject, html } = signInCodeEmail(issued.code, OTP_TTL_MINUTES);
    const sent = await sendEmailNow({ to: email, subject, html, template: "signin-code" });
    if (!sent.ok) return { error: "Could not send the email. Try again in a moment." };
  }

  return { sent: true, email };
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
  if (!parsed.success) return { error: "Start again — that email address is not valid." };
  if (code.length !== 6) return { error: "Enter the six digits from the email.", sent: true, email: parsed.data };

  const email = parsed.data;
  const ok = await consumeOtp(email, code);
  if (!ok) {
    return { error: "That code is wrong or has expired. Send a new one.", sent: true, email };
  }

  const admin = createAdminClient();
  let type: "magiclink" | "signup" = "magiclink";
  let link = await admin.auth.admin.generateLink({ type, email });

  if (link.error) {
    // No account yet. A password is required by the signup link API and is
    // never used by anything: sign-in is the code, every time. A random one
    // means no shared default exists to be tried against every account.
    type = "signup";
    link = await admin.auth.admin.generateLink({
      type,
      email,
      password: randomBytes(32).toString("base64url"),
    });
  }

  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return { error: "Could not complete sign-in. Try again in a moment.", sent: true, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
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
