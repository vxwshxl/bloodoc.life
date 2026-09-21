"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { donorRegistrationSchema } from "@/lib/validations/donor";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { registrationConfirmedEmail } from "@/lib/email/templates";
import { formatCampDate, formatTimeRange } from "@/lib/format";

export type RegisterState = {
  ok?: boolean;
  error?: string;
  /** Field name → first message, keyed exactly as the form's inputs are named. */
  fieldErrors?: Record<string, string>;
  donorName?: string;
};

/**
 * The public registration form.
 *
 * This runs on the service-role client, and that is a deliberate choice that
 * needs justifying. The alternative is an RLS policy letting anonymous visitors
 * insert into `donors` — which would mean the table's write rule is "anyone",
 * and every future query has to remember that. Keeping the policy strict and
 * routing the one public write through a validated action leaves exactly one
 * place where an unauthenticated row can be created, and it is this function.
 *
 * What it therefore has to do itself, because the database is not doing it:
 * validate every field, re-read the camp rather than trusting the posted id,
 * and refuse a camp that is not actually open.
 */
export async function registerDonor(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  if (!adminConfigured()) {
    return { error: "Registrations are not configured yet. Please contact the organisers." };
  }

  const parsed = donorRegistrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Some answers need a look.", fieldErrors };
  }
  const v = parsed.data;
  const admin = createAdminClient();

  // The camp is re-read, never trusted from the form. A posted id is a claim,
  // and "published" is what makes a camp open to strangers — a draft's id in a
  // hand-rolled POST must not put anyone on its roster.
  const { data: camp } = await admin
    .from("camps")
    .select("*")
    .eq("id", v.campId)
    .eq("status", "published")
    .maybeSingle();
  if (!camp) return { error: "That camp is not open for registration." };

  // Someone already signed in registers as themselves, so the record is linked
  // to their account from the start rather than at next sign-in.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const profileId = auth.user?.id ?? null;

  // One person, one donor row, keyed on email. A second camp six months later
  // should update the same record rather than fork a duplicate that then
  // disagrees with the first about their blood group.
  const { data: existing } = await admin
    .from("donors")
    .select("id, prior_donations")
    .eq("email", v.email)
    .maybeSingle();

  const donorFields = {
    full_name: v.fullName,
    sex: v.sex,
    date_of_birth: v.dateOfBirth,
    age: v.age,
    father_name: v.fatherName,
    mother_name: v.motherName,
    kind: v.kind,
    occupation: v.occupation,
    department: v.department,
    email: v.email,
    phone: v.phone,
    alt_phone: v.altPhone,
    address: v.address,
    blood_group: v.bloodGroup,
    prior_donations: v.priorDonations ?? (v.firstTime === "yes" ? 0 : existing?.prior_donations ?? 0),
    ...(profileId ? { profile_id: profileId } : {}),
  };

  let donorId: string;
  if (existing) {
    const { error } = await admin.from("donors").update(donorFields).eq("id", existing.id);
    if (error) return { error: "Could not save your details. Try again in a moment." };
    donorId = existing.id;
  } else {
    const { data, error } = await admin
      .from("donors")
      .insert(donorFields)
      .select("id")
      .single();
    if (error || !data) return { error: "Could not save your details. Try again in a moment." };
    donorId = data.id;
  }

  const { error: regError } = await admin
    .from("registrations")
    .upsert(
      {
        camp_id: camp.id,
        donor_id: donorId,
        first_time: v.firstTime === "yes",
        height_cm: v.heightCm,
        weight_kg: v.weightKg,
        medications: v.medications,
        status: "registered",
      },
      // A second submission of the same form (a double tap, a back button)
      // updates the row the unique constraint already guarantees, instead of
      // failing with a duplicate-key error the donor cannot act on.
      //
      // Note what is NOT in the payload: blood pressure and haemoglobin. This
      // upsert must never null out a reading the screening desk has already
      // recorded, which is exactly what would happen if those columns were
      // listed here and the donor re-opened their own form.
      { onConflict: "camp_id,donor_id" },
    );
  if (regError) return { error: "Could not complete your registration. Try again in a moment." };

  if (emailConfigured()) {
    const { subject, html } = registrationConfirmedEmail({
      donorName: v.fullName.split(" ")[0],
      campTitle: camp.title,
      when: `${formatCampDate(camp.starts_at)}, ${formatTimeRange(camp.starts_at, camp.ends_at)}`,
      venue: [camp.venue, camp.city].filter(Boolean).join(", "),
      bloodGroup: v.bloodGroup === "unknown" ? "To be tested" : v.bloodGroup,
      collaboration: camp.collaboration,
      partner: [camp.partner_name, camp.partner_note].filter(Boolean).join(", ") || null,
    });
    // Best-effort: the registration is already recorded, and a mail outage is
    // not a reason to tell someone their slot did not go through.
    await sendEmailNow({ to: v.email, toName: v.fullName, subject, html, template: "registration-confirmed" });
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/me");
  return { ok: true, donorName: v.fullName.split(" ")[0] };
}
