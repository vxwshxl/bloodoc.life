"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_VALUES } from "@/lib/roles";
import { requireAdmin, requireVerifier } from "@/lib/auth/dal";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { campReminderEmail, donorEncouragementEmail } from "@/lib/email/templates";
import { TEMPLATE_KEYS, copyFor } from "@/lib/email/copy";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { CONFIGURABLE_FIELDS, donorProfileSchema } from "@/lib/validations/donor";
import { CERTIFICATE_ART, STANDARD_CERTIFICATE } from "@/lib/certificates/artwork";
import { emailCertificateFor } from "@/lib/certificates/email";
import { translateCampTitle, translatorConfigured } from "@/lib/ai/translate";

export type ActionState = { ok?: boolean; error?: string; message?: string };

/**
 * Console writes.
 *
 * Each one calls `requireAdmin` and then uses the *caller's* client, not the
 * service role. That is belt and braces on purpose: the check gives a useful
 * redirect, and RLS refuses the statement underneath if the check is ever
 * removed or bypassed. An action that used the admin client would have only the
 * first of those.
 */

/**
 * A number box that is allowed to be empty.
 *
 * `z.coerce.number()` turns "" into 0, which would silently record a
 * haemoglobin of zero for every donor whose reading was not taken. Emptiness is
 * therefore handled before coercion, not after.
 */
const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine(
      (n) => n === null || (Number.isFinite(n) && n >= min && n <= max),
      `${label} should be between ${min} and ${max}.`,
    );

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const campSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Give the camp a title.").max(160),
  titleAs: z.string().trim().max(160).transform((s) => (s === "" ? null : s)),
  titleHi: z.string().trim().max(160).transform((s) => (s === "" ? null : s)),
  summary: z.string().trim().max(600).transform((s) => (s === "" ? null : s)),
  organiser: z.string().trim().max(200).transform((s) => (s === "" ? null : s)),
  contactPhone: z.string().trim().max(40).transform((s) => (s === "" ? null : s)),
  venue: z.string().trim().min(3, "Where is it?").max(200),
  city: z.string().trim().max(120).transform((s) => (s === "" ? null : s)),
  // `datetime-local` posts "2026-09-25T09:00" with no zone. The camp is in
  // India, so it is read as IST and stored as UTC — reading it as the server's
  // zone would file a 9am camp at 2:30pm in production and 9am in development.
  startsAt: z.string().trim().min(1, "When does it start?"),
  endsAt: z.string().trim(),
  capacity: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), "Capacity must be a whole number."),
  status: z.enum(["draft", "published", "closed"]),
  // An unticked checkbox posts nothing at all, so absence is the false case.
  // `z.coerce.boolean()` would be wrong here: it turns the string "false" into
  // true, which is exactly the shape a hidden input would send.
  listed: z.literal("on").optional().transform((v) => v === "on"),
  featured: z.literal("on").optional().transform((v) => v === "on"),
  collaboration: z.string().trim().max(200).transform((s) => (s === "" ? null : s)),
  partnerName: z.string().trim().max(200).transform((s) => (s === "" ? null : s)),
  partnerNote: z.string().trim().max(200).transform((s) => (s === "" ? null : s)),
  // A key of `CERTIFICATE_ART`, or "standard" for none. Unknown keys are
  // refused here because the database, deliberately, does not check them.
  certificateArt: z
    .string()
    .optional()
    .refine((k) => !k || k === STANDARD_CERTIFICATE || k in CERTIFICATE_ART, "Unknown certificate design.")
    .transform((k) => (!k || k === STANDARD_CERTIFICATE ? null : k)),
});

/** "2026-09-25T09:00" in IST → an ISO instant. */
function istToIso(local: string): string | null {
  if (!local) return null;
  const parsed = Date.parse(`${local}:00+05:30`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

export type TranslateState = {
  as?: string | null;
  hi?: string | null;
  /** False when no translator is set up, so the form can say so instead. */
  configured: boolean;
};

/**
 * The camp form's live translation: called as the English title is edited, so
 * the organiser sees the Assamese and Hindi before saving and can correct
 * them.
 */
export async function translateCampTitleAction(title: string): Promise<TranslateState> {
  await requireAdmin();
  const text = z.string().trim().min(3).max(160).safeParse(title);
  if (!text.success || !translatorConfigured()) return { configured: translatorConfigured() };
  return { configured: true, ...(await translateCampTitle(text.data)) };
}

export async function saveCamp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = campSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  // Ticked boxes sharing one name post several values, which
  // `Object.fromEntries` above would collapse to the last. Read separately,
  // and kept to known keys — the check constraint in 0019 would refuse others.
  const known = new Set<string>(CONFIGURABLE_FIELDS.map((f) => f.key));
  const requiredFields = [
    ...new Set(formData.getAll("requiredFields").map(String).filter((k) => known.has(k))),
  ];

  const startsAt = istToIso(v.startsAt);
  if (!startsAt) return { error: "That start time is not a valid date." };
  const endsAt = v.endsAt ? istToIso(v.endsAt) : null;
  if (endsAt && endsAt <= startsAt) return { error: "The camp cannot end before it starts." };

  const supabase = await createClient();

  // Renaming a camp renames it in every language.
  //
  // The form translates as the English title is typed, but this is the
  // guarantee: if the English title changed and a translated title was posted
  // back exactly as it was stored — the organiser did not touch it, or the
  // form's own translation did not arrive — it is translated again here.
  // A new camp with a blank translation gets one too. A translation the
  // organiser edited themselves is never replaced.
  let titleAs = v.titleAs;
  let titleHi = v.titleHi;
  {
    const { data: before } = v.id
      ? await supabase.from("camps").select("title, title_as, title_hi").eq("id", v.id).maybeSingle()
      : { data: null };
    const renamed = !before || before.title !== v.title;
    const staleAs = renamed && (before ? titleAs === before.title_as : !titleAs);
    const staleHi = renamed && (before ? titleHi === before.title_hi : !titleHi);
    if ((staleAs || staleHi) && translatorConfigured()) {
      const t = await translateCampTitle(v.title);
      if (staleAs && t.as) titleAs = t.as;
      if (staleHi && t.hi) titleHi = t.hi;
    }
  }

  // `camps_one_featured` (0011) rejects a second featured row outright, so the
  // previous holder is stood down first. Done here rather than in a trigger
  // because "the newest tick wins" is a product decision, not a data rule —
  // the database's job is only to guarantee there is never more than one.
  if (v.featured) {
    await supabase
      .from("camps")
      .update({ featured: false })
      .eq("featured", true)
      .neq("id", v.id ?? "00000000-0000-0000-0000-000000000000");
  }

  const row = {
    title: v.title,
    title_as: titleAs,
    title_hi: titleHi,
    summary: v.summary,
    organiser: v.organiser,
    contact_phone: v.contactPhone,
    listed: v.listed,
    featured: v.featured,
    venue: v.venue,
    city: v.city,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: v.capacity,
    status: v.status,
    collaboration: v.collaboration,
    partner_name: v.partnerName,
    partner_note: v.partnerNote,
    required_fields: requiredFields,
    certificate_art: v.certificateArt,
  };

  if (v.id) {
    // The slug is not updated on edit. It is in the camp's public URL and in
    // every confirmation email already sent; renaming a camp must not 404 the
    // link somebody was given.
    const { error } = await supabase.from("camps").update(row).eq("id", v.id);
    if (error) return { error: "Could not save the camp." };
  } else {
    const base = slugify(v.title) || "camp";
    const { error } = await supabase
      .from("camps")
      // The date suffix keeps an annual camp with the same title from colliding
      // with last year's, which is the only collision that happens in practice.
      .insert({ ...row, slug: `${base}-${startsAt.slice(0, 10)}` });
    if (error) {
      return {
        error: error.code === "23505" ? "A camp with that name and date already exists." : "Could not create the camp.",
      };
    }
  }

  revalidatePath("/admin/camps");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: v.id ? "Camp saved." : "Camp created." };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["registered", "screened", "donated", "deferred", "cancelled"]),
  deferralReason: z.string().trim().max(400).optional(),
});

export async function setRegistrationStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // `requireVerifier`, not `requireAdmin`. This is the control on the desk
  // roster, and gating it on admin meant a verifier tapping "Donated" was
  // redirected to /me — the exact work 0014 wrote them policies for. The
  // policies are still what decide; this only stops the wrong person waiting
  // for an update that was never going to happen.
  await requireVerifier();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "That status is not one of the five." };
  const { id, status, deferralReason } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      status,
      // Clearing the reason when the status moves off "deferred" matters: a
      // stale "low haemoglobin" sitting on a row that now reads "donated" is
      // worse than no note at all.
      deferral_reason: status === "deferred" ? (deferralReason || null) : null,
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: "Could not update that registration." };
  // An update RLS refused comes back as a success with no rows.
  if (!data?.length) return { error: "You do not have permission to change that record." };

  // The trigger has just issued the certificate; this hands it over.
  if (status === "donated") await emailCertificateFor(id);

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  revalidatePath("/desk", "layout");
  return { ok: true };
}

/**
 * The screening readings, recorded at the desk.
 *
 * These are the two fields the public form deliberately does not collect —
 * they are measured here, by someone with a cuff and a haemoglobin test, and
 * this is the only path that writes them.
 *
 * Empty means "not taken", not zero, so a blank box clears the column rather
 * than recording a blood pressure of nothing. That distinction is the whole
 * reason these are nullable.
 */
const vitalsSchema = z.object({
  id: z.string().uuid(),
  heightCm: optionalNumber(100, 250, "Height"),
  weightKg: optionalNumber(30, 300, "Weight"),
  bpSystolic: optionalNumber(60, 260, "Systolic pressure"),
  bpDiastolic: optionalNumber(30, 160, "Diastolic pressure"),
  // Wider than the 12.5 g/dL donation cutoff on purpose: the reading that
  // caused a deferral is by definition below it, and a field that refused to
  // hold it would only work for people who passed.
  hemoglobin: optionalNumber(3, 25, "Haemoglobin"),
  // Beats per minute: a count, and the column is a smallint.
  pulse: optionalNumber(30, 220, "Pulse").refine(
    (n) => n === null || Number.isInteger(n),
    "Pulse is a whole number of beats per minute.",
  ),
});

export async function setRegistrationVitals(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Same as the status control above: taking a cuff reading is the desk's job.
  await requireVerifier();
  const parsed = vitalsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Blood pressure is a pair; one half of it is not a reading.
  if ((v.bpSystolic === null) !== (v.bpDiastolic === null)) {
    return { error: "Enter both blood pressure numbers, or neither." };
  }
  if (v.bpSystolic !== null && v.bpDiastolic !== null && v.bpDiastolic >= v.bpSystolic) {
    return { error: "The lower blood pressure number should be below the upper one." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({
      height_cm: v.heightCm,
      weight_kg: v.weightKg,
      bp_systolic: v.bpSystolic,
      bp_diastolic: v.bpDiastolic,
      hemoglobin_gdl: v.hemoglobin,
      pulse_bpm: v.pulse,
    })
    .eq("id", v.id);
  if (error) return { error: "Could not save those readings." };

  revalidatePath("/admin/registrations");
  return { ok: true, message: "Saved." };
}

/**
 * Everything on one registration, saved together.
 *
 * The roster already has a status control and a vitals cell, and they write
 * separately because on the roster they are used separately — a status is
 * tapped between donors, a reading is typed once. The detail dialog is the
 * other case: somebody has opened one person's record and is correcting it,
 * and making them save three times, with three toasts and three chances for
 * one of them to fail alone, is not the same interaction at all.
 *
 * So this is one write. It reuses the same validation as the two narrow
 * actions rather than restating it, because a rule that holds in one place and
 * not the other is worse than no rule.
 */
const detailSchema = vitalsSchema.extend({
  status: z.enum(["registered", "screened", "donated", "deferred", "cancelled"]),
  firstTime: z.literal("on").optional().transform((v) => v === "on"),
  medications: z.string().trim().max(400).optional(),
  deferralReason: z.string().trim().max(400).optional(),
});

export async function saveRegistration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireVerifier();
  const parsed = detailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Blood pressure is a pair; one half of it is not a reading.
  if ((v.bpSystolic === null) !== (v.bpDiastolic === null)) {
    return { error: "Enter both blood pressure numbers, or neither." };
  }
  if (v.bpSystolic !== null && v.bpDiastolic !== null && v.bpDiastolic >= v.bpSystolic) {
    return { error: "The lower blood pressure number should be below the upper one." };
  }
  if (v.status === "deferred" && !v.deferralReason) {
    // The one status that is useless without a note: the next camp needs to
    // know whether it was low haemoglobin or a cold.
    return { error: "A deferral needs a reason." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      status: v.status,
      first_time: v.firstTime,
      height_cm: v.heightCm,
      weight_kg: v.weightKg,
      bp_systolic: v.bpSystolic,
      bp_diastolic: v.bpDiastolic,
      hemoglobin_gdl: v.hemoglobin,
      pulse_bpm: v.pulse,
      medications: v.medications || null,
      // Cleared when the status moves off "deferred": a stale "low
      // haemoglobin" sitting on a row that now reads "donated" is worse than
      // no note at all.
      deferral_reason: v.status === "deferred" ? (v.deferralReason || null) : null,
    })
    .eq("id", v.id)
    .select("id");

  if (error) return { error: "Could not save that registration." };
  // PostgREST reports a delete or update that matched no policy as a success
  // with no rows, so "nothing happened" must not be reported as "saved".
  if (!data?.length) return { error: "You do not have permission to change that record." };

  // Safe on every save of a donated row: the claim sends at most once.
  if (v.status === "donated") await emailCertificateFor(v.id);

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  revalidatePath("/desk", "layout");
  return { ok: true, message: "Saved." };
}

export type DonorEditState = ActionState & { fieldErrors?: Record<string, string> };

/**
 * An administrator correcting the answers on somebody's registration form.
 *
 * The same schema the donor's own editor uses, so the console cannot store an
 * answer the form would have refused. What it writes is the donor record —
 * that is where the form's answers live, and the next camp reads them from
 * there — so a correction made from one registration is a correction
 * everywhere, which is the point.
 *
 * The email can be corrected too, and because the address is the account it
 * moves as one: a donor with no account just gets the new address (the signup
 * trigger links it when they first sign in); a donor with one has their sign-in
 * moved to it, or nothing changes. An address another donor or account already
 * has is refused rather than merged. The readings (height, weight,
 * medications) belong to the registration, and are saved by
 * `saveRegistration` alongside the rest of the day's numbers.
 *
 * `requireAdmin`, not `requireVerifier`: the desk records what it measures,
 * but who a person is is not something to be retyped between donors.
 */
export async function adminUpdateDonor(
  _prev: DonorEditState,
  formData: FormData,
): Promise<DonorEditState> {
  await requireAdmin();

  const donorId = z.string().uuid().safeParse(formData.get("donorId"));
  if (!donorId.success) return { error: "That donor record could not be found." };

  const parsed = donorProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Some answers need a look.", fieldErrors };
  }
  const v = parsed.data;

  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) {
    return { error: "Some answers need a look.", fieldErrors: { email: "Enter a valid email address." } };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("donors")
    .select("email, profile_id")
    .eq("id", donorId.data)
    .maybeSingle();
  if (!current) return { error: "That donor record could not be found." };
  const emailChanged = current.email.toLowerCase() !== email.data;

  if (emailChanged) {
    // One person, one donor row: registration finds a returning donor by
    // address, so two rows sharing one would split their history.
    const { data: clash } = await supabase
      .from("donors")
      .select("id")
      .ilike("email", email.data.replace(/[\\%_]/g, "\\$&"))
      .neq("id", donorId.data)
      .limit(1);
    if (clash?.length) {
      return {
        error: "Some answers need a look.",
        fieldErrors: { email: "Another donor already uses this address." },
      };
    }
  }

  const { data, error } = await supabase
    .from("donors")
    .update({
      full_name: v.fullName,
      sex: v.sex,
      date_of_birth: v.dateOfBirth,
      age: v.age,
      father_title: v.fatherTitle,
      father_name: v.fatherName,
      mother_title: v.motherTitle,
      mother_name: v.motherName,
      husband_title: v.husbandTitle,
      husband_name: v.husbandName,
      kind: v.kind,
      occupation: v.occupation,
      school: v.school,
      department: v.department,
      phone: v.phone,
      alt_phone: v.altPhone,
      address: v.address,
      permanent_address: v.permanentAddress,
      blood_group: v.bloodGroup,
      prior_donations: v.priorDonations ?? 0,
      email: email.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", donorId.data)
    .select("id");

  if (error) return { error: "Could not save those details." };
  // Zero rows is RLS refusing, not a missing donor; say so rather than "saved".
  if (!data?.length) return { error: "You do not have permission to change that record." };

  // A linked donor's sign-in follows the address, or the record and the
  // account would disagree about who this is (and phone sign-in, which finds
  // the account through this address, would land somewhere new).
  if (emailChanged && current.profile_id) {
    const moved = await moveSignIn(current.profile_id, email.data);
    if (!moved.ok) {
      await supabase.from("donors").update({ email: current.email }).eq("id", donorId.data);
      return { error: moved.error, fieldErrors: { email: moved.error } };
    }
  }

  revalidatePath("/admin/registrations");
  revalidatePath("/admin/donors");
  revalidatePath("/admin");
  return { ok: true, message: "Registration form updated." };
}

/**
 * Move an account's sign-in to a new address: the auth user, then its profile.
 * Service role, because no session may change another user's sign-in; the
 * caller has already passed `requireAdmin`.
 */
async function moveSignIn(
  profileId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "This donor has an account, and moving its sign-in is not configured here." };
  }
  const { error } = await admin.auth.admin.updateUserById(profileId, { email, email_confirm: true });
  if (error) {
    return {
      ok: false,
      error: /registered|exists|already/i.test(error.message)
        ? "Another account already signs in with this address."
        : "Could not move this donor's sign-in to the new address.",
    };
  }
  await admin.from("profiles").update({ email }).eq("id", profileId);
  return { ok: true };
}

/**
 * Mail everyone registered for a camp.
 *
 * Sequential, not `Promise.all`. ZeptoMail rate-limits, and firing three
 * hundred concurrent requests is how a batch half-sends and leaves nobody able
 * to say which half. Slower and legible beats faster and ambiguous here.
 */
export async function sendCampReminders(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!emailConfigured()) return { error: "Email is not configured (ZEPTOMAIL_TOKEN)." };

  const campId = String(formData.get("campId") ?? "");
  if (!z.string().uuid().safeParse(campId).success) return { error: "Pick a camp." };

  const supabase = await createClient();
  const { data: camp } = await supabase.from("camps").select("*").eq("id", campId).maybeSingle();
  if (!camp) return { error: "That camp no longer exists." };

  const { data: rows } = await supabase
    .from("registrations")
    .select("donor:donors(full_name, email)")
    .eq("camp_id", campId)
    .in("status", ["registered", "screened"]);

  const recipients = (rows ?? [])
    .map((r) => (r as unknown as { donor: { full_name: string; email: string } | null }).donor)
    .filter((d): d is { full_name: string; email: string } => !!d?.email);

  if (!recipients.length) return { error: "Nobody on this roster to write to." };

  const when = `${formatCampDate(camp.starts_at)}, ${formatTimeRange(camp.starts_at, camp.ends_at)}`;
  const venue = [camp.venue, camp.city].filter(Boolean).join(", ");

  let sent = 0;
  for (const d of recipients) {
    const name = d.full_name.split(" ")[0];
    // Per recipient, because {{name}} differs for each of them. `getTemplateCopy`
    // is cached for the render pass, so this is one read however long the
    // roster is.
    const copy = await copyFor("camp_reminder", {
      name,
      camp: camp.title,
      when,
      venue,
    });
    const { subject, html } = campReminderEmail({
      donorName: name,
      campTitle: camp.title,
      when,
      venue,
    }, copy);
    const res = await sendEmailNow({
      to: d.email,
      toName: d.full_name,
      subject,
      html,
      template: "camp-reminder",
    });
    if (res.ok) sent += 1;
  }

  revalidatePath("/admin/email");
  return {
    ok: true,
    message:
      sent === recipients.length
        ? `Reminder sent to ${sent} donors.`
        : `Sent ${sent} of ${recipients.length}. The rest are in the email log with their errors.`,
  };
}

/**
 * Encourage the donors who came to a camp and could not donate (marked
 * cancelled at the desk), with everyday tips for next time.
 *
 * At most once per donor per camp: the log's template is tagged with the camp,
 * and an address that already has a delivered one is skipped, so pressing the
 * button again later reaches only the people cancelled since.
 */
export async function sendDonorEncouragement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!emailConfigured()) return { error: "Email is not configured (ZEPTOMAIL_TOKEN)." };

  const campId = z.uuid().safeParse(formData.get("campId"));
  if (!campId.success) return { error: "Pick a camp." };

  const supabase = await createClient();
  const { data: camp } = await supabase.from("camps").select("*").eq("id", campId.data).maybeSingle();
  if (!camp) return { error: "That camp no longer exists." };

  const { data: rows } = await supabase
    .from("registrations")
    .select("donor:donors(full_name, email)")
    .eq("camp_id", camp.id)
    .eq("status", "cancelled");

  const template = `donor-encouragement:${camp.id}`;
  const { data: already } = await supabase
    .from("email_log")
    .select("to_email")
    .eq("template", template)
    .eq("ok", true);
  const done = new Set((already ?? []).map((r) => r.to_email.toLowerCase()));

  // One email per address, even if a donor somehow has two cancelled rows.
  const recipients = new Map<string, { full_name: string; email: string }>();
  for (const r of rows ?? []) {
    const d = (r as unknown as { donor: { full_name: string; email: string } | null }).donor;
    if (d?.email && !done.has(d.email.toLowerCase())) recipients.set(d.email.toLowerCase(), d);
  }

  if (!recipients.size) {
    return {
      error: rows?.length
        ? "Everyone marked cancelled at this camp has already been sent this email."
        : "Nobody is marked cancelled at this camp.",
    };
  }

  const campDate = formatCampDate(camp.starts_at);
  let sent = 0;
  for (const d of recipients.values()) {
    const name = d.full_name.split(" ")[0];
    const copy = await copyFor("donor_encouragement", { name, camp: camp.title });
    const { subject, html } = donorEncouragementEmail({ donorName: name, campTitle: camp.title, campDate }, copy);
    const res = await sendEmailNow({ to: d.email, toName: d.full_name, subject, html, template });
    if (res.ok) sent += 1;
  }

  revalidatePath("/admin/email");
  return {
    ok: true,
    message:
      sent === recipients.size
        ? `Encouragement sent to ${sent} ${sent === 1 ? "donor" : "donors"}.`
        : `Sent ${sent} of ${recipients.size}. The rest are in the email log with their errors.`,
  };
}

/**
 * Delete one logged email, or every logged email.
 *
 * Runs on the session client so `email_log_admin_write` (0010) is what actually
 * decides — `requireAdmin` here only saves the round trip and gives a better
 * landing than a silent no-op.
 *
 * Deleting the log does not unsend anything, and the audit trail is a separate
 * table with no delete policy at all, so this cannot be used to cover tracks.
 */
export async function deleteEmailLog(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const all = formData.get("all") === "true";

  const supabase = await createClient();
  if (all) {
    // Postgres has no "delete everything" without a predicate through PostgREST,
    // and a tautology is the documented way to say it deliberately.
    const { error } = await supabase.from("email_log").delete().not("id", "is", null);
    if (error) return { error: "Could not clear the log." };
  } else {
    if (!id) return { error: "Unknown message." };
    const { error } = await supabase.from("email_log").delete().eq("id", id);
    if (error) return { error: "Could not delete that message." };
  }

  revalidatePath("/admin/email");
  return { ok: true };
}

/**
 * Delete a camp, and everything that hangs off it.
 *
 * Runs on the session client, so `camps_write_admin` is what actually decides.
 * The cascade reaches two tables deeper than the row being deleted —
 * registrations by foreign key, certificates by cascade from those — which is
 * why the confirm dialog quotes both counts instead of a generic warning.
 *
 * Not a soft delete, deliberately. `status = 'closed'` already exists and is
 * the right answer for "this camp has finished"; a second, invisible kind of
 * hidden camp would mean every query in the console needs to know about it.
 * This is for a camp created by mistake.
 *
 * The audit trigger from 0010 records the delete with the whole row in
 * `changes`, so what was removed is still answerable afterwards.
 */
export async function deleteCamp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("campId"));
  if (!id.success) return { error: "Unknown camp." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("camps")
    .delete()
    .eq("id", id.data)
    .select("id, title")
    .maybeSingle();

  if (error) return { error: "Could not delete that camp." };
  // Zero rows back is RLS refusing, not a missing row.
  if (!data) return { error: "That camp could not be deleted." };

  revalidatePath("/admin/camps");
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true, message: `“${data.title}” deleted.` };
}

/**
 * Save the copy overrides for one email template.
 *
 * An upsert on the key, and a blank field is stored as null rather than an
 * empty string — `copyFor` treats null as "use the built-in wording", and a
 * stored "" would otherwise send an email with no heading at all.
 */
export async function saveTemplateCopy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      // Every template the console lists; a hand-kept list here once left
      // certificate_issued out, so its wording could not be saved.
      key: z.enum(TEMPLATE_KEYS),
      subject: z.string().trim().max(200),
      heading: z.string().trim().max(200),
      lead: z.string().trim().max(1000),
    })
    .safeParse({
      key: formData.get("key"),
      subject: formData.get("subject") ?? "",
      heading: formData.get("heading") ?? "",
      lead: formData.get("lead") ?? "",
    });
  if (!parsed.success) return { error: "That copy is too long, or the template is unknown." };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("email_templates").upsert(
    {
      key: v.key,
      subject: v.subject || null,
      heading: v.heading || null,
      lead: v.lead || null,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    },
    { onConflict: "key" },
  );
  if (error) return { error: "Could not save that template." };

  revalidatePath("/admin/templates");
  return { ok: true, message: "Template saved." };
}

/** Restore a template to the wording written in the code. */
export async function resetTemplateCopy(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!key) return { error: "Unknown template." };

  const supabase = await createClient();
  // Deleting the row *is* the reset: `copyFor` falls back to the built-in
  // wording whenever there is nothing stored.
  const { error } = await supabase.from("email_templates").delete().eq("key", key);
  if (error) return { error: "Could not reset that template." };

  revalidatePath("/admin/templates");
  return { ok: true, message: "Reset to the built-in wording." };
}

/**
 * Change somebody's role.
 *
 * Two guards, both of which exist because the failure they prevent is
 * unrecoverable from inside the app:
 *
 *  - You cannot demote yourself. Not paternalism — a single-admin deployment
 *    where the admin clicks "donor" has nobody left who can undo it, and the
 *    fix is a SQL console.
 *  - You cannot remove the last administrator, for the same reason via a
 *    different route.
 *
 * `profiles.role` is what every RLS policy reads, so this is the highest-
 * privilege write in the console. It runs on the session client, so
 * `profiles_admin_all` is the rule that actually decides.
 */
export async function setUserRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireAdmin();
  const parsed = z
    .object({ profileId: z.uuid(), role: z.enum(ROLE_VALUES) })
    .safeParse({ profileId: formData.get("profileId"), role: formData.get("role") });
  if (!parsed.success) return { error: "Unknown user or role." };
  const v = parsed.data;

  if (v.profileId === me.id && v.role !== "admin") {
    return { error: "You cannot remove your own administrator access." };
  }

  const supabase = await createClient();

  if (v.role !== "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "This is the only administrator. Promote somebody else first." };
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role: v.role, updated_at: new Date().toISOString() })
    .eq("id", v.profileId)
    .select("id, email")
    .maybeSingle();

  if (error) return { error: "Could not change that role." };
  if (!data) return { error: "That account could not be updated." };

  // "Donor" on the Users page means no console access at all, so it also
  // takes away any organisation or blood bank membership. Otherwise the row
  // would go on reading "Blood bank" after being set to Donor.
  if (v.role === "donor") {
    const { error: memberError } = await supabase
      .from("partner_members")
      .delete()
      .eq("profile_id", v.profileId);
    if (memberError) return { error: "Role changed, but their partner access could not be removed." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/partners");
  const labels: Record<string, string> = {
    admin: "an administrator",
    verifier: "a verifier",
    donor: "a donor",
  };
  return { ok: true, message: `${data.email} is now ${labels[v.role]}.` };
}

/**
 * Give an account organisation or blood bank access, from the Users page.
 *
 * The same membership the partner page's invite creates, written against the
 * account directly — it already exists, so there is nothing to wait for it to
 * claim. The account's own role drops to donor: the Users table shows one
 * access per person, and an administrator or verifier who stayed one would
 * go on seeing far more than the body they were just placed in.
 */
export async function grantPartnerAccess(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const me = await requireAdmin();
  const parsed = z
    .object({ profileId: z.uuid(), partnerId: z.uuid() })
    .safeParse({ profileId: formData.get("profileId"), partnerId: formData.get("partnerId") });
  if (!parsed.success) return { error: "Pick who to add them to." };
  const v = parsed.data;

  if (v.profileId === me.id) {
    return { error: "You cannot remove your own administrator access." };
  }

  const supabase = await createClient();
  const [{ data: profile }, { data: partner }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", v.profileId).maybeSingle(),
    supabase.from("partners").select("id, name, kind").eq("id", v.partnerId).maybeSingle(),
  ]);
  if (!profile || !partner) return { error: "That account or body could not be found." };

  if (profile.role === "admin") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return { error: "This is the only administrator. Promote somebody else first." };
    }
  }

  const { error } = await supabase.from("partner_members").insert({
    partner_id: partner.id,
    profile_id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: "member",
  });
  if (error && error.code === "23505") {
    // Already invited by this address: link the invite to the account.
    const { error: linkError } = await supabase
      .from("partner_members")
      .update({ profile_id: profile.id })
      .eq("partner_id", partner.id)
      .ilike("email", profile.email);
    if (linkError) return { error: "Could not add them." };
  } else if (error) {
    return { error: "Could not add them." };
  }

  if (profile.role !== "donor") {
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "donor", updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    if (roleError) return { error: `Added to ${partner.name}, but their old role could not be removed.` };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/partners");
  const what = partner.kind === "blood_bank" ? "blood bank" : "organisation";
  return { ok: true, message: `${profile.email} now has ${what} access for ${partner.name}.` };
}
