"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { requireUser, getProfile } from "@/lib/auth/dal";
import { getEffectiveProfile } from "@/lib/auth/impersonation";
import { donorProfileSchema } from "@/lib/validations/donor";
import { consumeOtp, issueOtp, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { profileChangeCodeEmail } from "@/lib/email/templates";
import { copyFor } from "@/lib/email/copy";

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** True once a code has gone out and the form is waiting for it. */
  awaitingCode?: boolean;
  message?: string;
};

const PURPOSE = "profile_update";

/**
 * Step one: ask for a code.
 *
 * The donor record is what the screening desk reads on the day — blood group,
 * age, what they are taking — so rewriting it is worth the same proof of inbox
 * that signing in takes. Without it, a session left open on a shared campus
 * machine is enough to change the group somebody will be screened against.
 *
 * A distinct `purpose` from the sign-in code, so neither can be replayed as
 * the other.
 */
export async function requestProfileChangeCode(
  _prev: ProfileState,
  _formData: FormData,
): Promise<ProfileState> {
  await requireUser();
  const profile = await getProfile();
  if (!profile) return { error: "Sign in again to make changes." };
  if (!emailConfigured()) {
    return { error: "Email is not set up, so changes cannot be confirmed right now." };
  }

  const issued = await issueOtp(profile.email, PURPOSE);
  if (issued.status === "error") {
    return { error: "Could not send a code. Try again in a moment." };
  }
  // A cooldown hit still reports success: a code is already in their inbox, and
  // saying "wait 30 seconds" to someone who has one is just noise.
  if (issued.status === "issued") {
    const copy = await copyFor("profile_change", {
      code: issued.code,
      minutes: String(OTP_TTL_MINUTES),
    });
    const { subject, html } = profileChangeCodeEmail(issued.code, OTP_TTL_MINUTES, copy);
    const sent = await sendEmailNow({
      to: profile.email,
      subject,
      html,
      template: "profile-change",
    });
    if (!sent.ok) return { error: "Could not send the email. Try again in a moment." };
  }

  return {
    awaitingCode: true,
    message: `We sent a confirmation code to ${profile.email}.`,
  };
}

/**
 * Step two: check the code, then write the record.
 *
 * The email address is deliberately absent from the schema and from this
 * function. It is the account — changing it here would either orphan the
 * donor's own record or point it at somebody else's, and there is no
 * verification of the *new* address in this flow that would make it safe.
 */
export async function updateMyProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  await requireUser();

  // An administrator rehearsing somebody's view must not be able to rewrite
  // their record by accident: the code would go to the donor's inbox, which
  // the admin cannot read, but refusing outright is clearer than a form that
  // silently cannot be completed.
  const effective = await getEffectiveProfile();
  if (effective?.viewingAs) {
    return { error: "Stop viewing as this person before editing their record." };
  }

  const profile = await getProfile();
  if (!profile) return { error: "Sign in again to make changes." };
  if (!adminConfigured()) return { error: "Profile changes are not configured." };

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) {
    return { awaitingCode: true, error: "Enter the six digits from the email." };
  }

  const parsed = donorProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Some answers need a look.", fieldErrors };
  }

  // Verified before anything is written, and consumed on success so the same
  // code cannot be used for a second edit.
  const ok = await consumeOtp(profile.email, code, PURPOSE);
  if (!ok) {
    return { awaitingCode: true, error: "That code is wrong or has expired. Send a new one." };
  }

  const v = parsed.data;
  const admin = createAdminClient();

  // Keyed on the profile, not on an id from the form: a donor id in a
  // hand-rolled POST must not be able to rewrite somebody else's record.
  const { data: existing } = await admin
    .from("donors")
    .select("id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const row = {
    full_name: v.fullName,
    sex: v.sex,
    date_of_birth: v.dateOfBirth,
    age: v.age,
    father_name: v.fatherName,
    mother_name: v.motherName,
    kind: v.kind,
    occupation: v.occupation,
    department: v.department,
    phone: v.phone,
    alt_phone: v.altPhone,
    address: v.address,
    blood_group: v.bloodGroup,
    prior_donations: v.priorDonations ?? 0,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await admin.from("donors").update(row).eq("id", existing.id);
    if (error) return { error: "Could not save your details. Try again in a moment." };
  } else {
    // First time: a partner member or an admin who has never registered still
    // gets a record, so the page is an editor rather than a dead end.
    const { error } = await admin
      .from("donors")
      .insert({ ...row, email: profile.email, profile_id: profile.id });
    if (error) return { error: "Could not save your details. Try again in a moment." };
  }

  // The name on the account follows the name on the record, so the console and
  // the emails stop addressing somebody by an email address.
  await admin.from("profiles").update({ full_name: v.fullName }).eq("id", profile.id);

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { ok: true, message: "Your record has been updated." };
}
