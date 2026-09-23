"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ROLE_VALUES } from "@/lib/roles";
import { requireAdmin, requireVerifier } from "@/lib/auth/dal";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { campReminderEmail } from "@/lib/email/templates";
import { copyFor } from "@/lib/email/copy";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { CONFIGURABLE_FIELDS } from "@/lib/validations/donor";

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
});

/** "2026-09-25T09:00" in IST → an ISO instant. */
function istToIso(local: string): string | null {
  if (!local) return null;
  const parsed = Date.parse(`${local}:00+05:30`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
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
    title_as: v.titleAs,
    title_hi: v.titleHi,
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

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
  revalidatePath("/desk", "layout");
  return { ok: true, message: "Saved." };
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
      key: z.enum([
        "signin_code",
        "registration_confirmed",
        "camp_reminder",
        "profile_change",
        "signin_alert",
      ]),
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

  revalidatePath("/admin/users");
  const labels: Record<string, string> = {
    admin: "an administrator",
    verifier: "a verifier",
    donor: "a donor",
  };
  return { ok: true, message: `${data.email} is now ${labels[v.role]}.` };
}
