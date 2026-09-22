"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireConsoleUser } from "@/lib/auth/dal";

/**
 * Writes from the partner panel.
 *
 * All of these run on the *session* client, not the service role. That is the
 * whole design: "may this person mark this donor as donated" is answered once,
 * in `registrations_update_bloodbank`, and an action that bypassed RLS would be
 * a second copy of that rule written in TypeScript, free to drift from the
 * first. The `requireConsoleUser()` call at the top of each is a redirect for a
 * better landing, not the security check — if it were removed the database
 * would still refuse.
 *
 * The consequence to keep in mind: a refused write comes back as zero rows
 * affected, not as an exception. Every one of these therefore asks for the row
 * back and treats "nothing returned" as "not allowed".
 */

export type ActionState = { ok?: boolean; error?: string };

const outcomeSchema = z.object({
  registrationId: z.uuid(),
  status: z.enum(["registered", "screened", "donated", "deferred", "cancelled"]),
  // Vitals are optional on every path: a deferral at the desk is often recorded
  // before the cuff comes off, and refusing the update until every box is full
  // means it is written on paper instead.
  heightCm: z.coerce.number().min(100).max(250).optional().nullable(),
  weightKg: z.coerce.number().min(30).max(300).optional().nullable(),
  bpSystolic: z.coerce.number().min(60).max(260).optional().nullable(),
  bpDiastolic: z.coerce.number().min(30).max(160).optional().nullable(),
  hemoglobinGdl: z.coerce.number().min(3).max(25).optional().nullable(),
  medications: z.string().max(500).optional().nullable(),
  deferralReason: z.string().max(500).optional().nullable(),
});

/** Blank strings from an untouched number input are absent, not zero. */
function blankToNull(v: FormDataEntryValue | null) {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

/**
 * Record what happened at the desk.
 *
 * Reaching `donated` is what mints the certificate, and that happens in a
 * trigger rather than here — see `handle_registration_donated` in 0008. A
 * donation entered by an admin fixing a typo, by an import, or by this action
 * all produce a certificate, because none of them can skip the trigger.
 */
export async function recordOutcome(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireConsoleUser();

  const parsed = outcomeSchema.safeParse({
    registrationId: formData.get("registrationId"),
    status: formData.get("status"),
    heightCm: blankToNull(formData.get("heightCm")),
    weightKg: blankToNull(formData.get("weightKg")),
    bpSystolic: blankToNull(formData.get("bpSystolic")),
    bpDiastolic: blankToNull(formData.get("bpDiastolic")),
    hemoglobinGdl: blankToNull(formData.get("hemoglobinGdl")),
    medications: blankToNull(formData.get("medications")),
    deferralReason: blankToNull(formData.get("deferralReason")),
  });
  if (!parsed.success) return { error: "Those readings do not look right. Check and try again." };
  const v = parsed.data;

  // A deferral with no reason is a record nobody can act on later — the donor
  // asks why they were turned away and the roster cannot say.
  if (v.status === "deferred" && !v.deferralReason) {
    return { error: "A deferral needs a reason." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .update({
      status: v.status,
      height_cm: v.heightCm,
      weight_kg: v.weightKg,
      bp_systolic: v.bpSystolic,
      bp_diastolic: v.bpDiastolic,
      hemoglobin_gdl: v.hemoglobinGdl,
      medications: v.medications,
      deferral_reason: v.deferralReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", v.registrationId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not save that. Try again in a moment." };
  // Zero rows back is RLS refusing, not a missing row: an organisation member
  // reached a control only the blood bank may use.
  if (!data) {
    return { error: "Only the blood bank running this camp can record an outcome." };
  }

  revalidatePath("/partner");
  revalidatePath("/partner/registrations");
  revalidatePath("/partner/certificates");
  revalidatePath("/admin/registrations");
  revalidatePath("/me");
  return { ok: true };
}

/**
 * Approve a pending certificate.
 *
 * `issued_by` is read from the session rather than the form for the obvious
 * reason: a signature a client can set is not a signature.
 */
export async function approveCertificate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireConsoleUser();
  const id = z.uuid().safeParse(formData.get("certificateId"));
  if (!id.success) return { error: "Unknown certificate." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .update({
      status: "approved",
      issued_at: new Date().toISOString(),
      issued_by: profile.id,
      revoked_at: null,
      revoked_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not approve that certificate." };
  if (!data) return { error: "Only the blood bank running this camp can approve certificates." };

  revalidatePath("/partner/certificates");
  revalidatePath("/me");
  return { ok: true };
}

/**
 * Withdraw one.
 *
 * An update, never a delete. A certificate that was printed, emailed and
 * screenshotted cannot be unsent, so the honest behaviour is for its code to
 * keep resolving at /verify and say plainly that it is no longer valid.
 */
export async function revokeCertificate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireConsoleUser();
  const parsed = z
    .object({ certificateId: z.uuid(), reason: z.string().trim().min(3).max(300) })
    .safeParse({
      certificateId: formData.get("certificateId"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { error: "Say briefly why it is being withdrawn." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_reason: parsed.data.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.certificateId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not withdraw that certificate." };
  if (!data) return { error: "Only the blood bank running this camp can withdraw certificates." };

  revalidatePath("/partner/certificates");
  revalidatePath("/me");
  return { ok: true };
}

// --------------------------------------------------------------------------
// Admin: the bodies themselves, and who may sign in for them.
// --------------------------------------------------------------------------

const partnerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  shortName: z.string().trim().max(80).optional().nullable(),
  kind: z.enum(["organisation", "blood_bank"]),
  parentInstitution: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  contactEmail: z.email().optional().nullable().or(z.literal("").transform(() => null)),
  contactPhone: z.string().trim().max(40).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
});

/** A URL-safe handle derived from the name, since nobody wants to type one. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createPartner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    shortName: blankToNull(formData.get("shortName")),
    kind: formData.get("kind"),
    parentInstitution: blankToNull(formData.get("parentInstitution")),
    city: blankToNull(formData.get("city")),
    contactEmail: blankToNull(formData.get("contactEmail")),
    contactPhone: blankToNull(formData.get("contactPhone")),
    website: blankToNull(formData.get("website")),
  });
  if (!parsed.success) return { error: "Check the name and contact details." };
  const v = parsed.data;

  const supabase = await createClient();
  // The slug is unique, and two bodies with the same name is a real case (two
  // NSS units, different colleges). A suffix beats failing the insert.
  const base = slugify(v.name);
  const { data: clash } = await supabase.from("partners").select("slug").eq("slug", base).maybeSingle();
  const slug = clash ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;

  const { error } = await supabase.from("partners").insert({
    slug,
    name: v.name,
    short_name: v.shortName,
    kind: v.kind,
    parent_institution: v.parentInstitution,
    city: v.city,
    contact_email: v.contactEmail,
    contact_phone: v.contactPhone,
    website: v.website,
  });
  if (error) return { error: "Could not add that partner." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * Add someone to a partner's panel.
 *
 * The address IS the invite — no token, no expiry, no separate acceptance
 * screen. The row sits unclaimed until that person signs in with the same
 * address, and the signup trigger links it. Nothing is emailed here, which
 * means an address typed wrong grants nobody anything: the row simply never
 * matches a sign-in.
 */
export async function invitePartnerMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      partnerId: z.uuid(),
      email: z.email(),
      fullName: z.string().trim().max(120).optional().nullable(),
      title: z.string().trim().max(120).optional().nullable(),
      role: z.enum(["owner", "member"]),
    })
    .safeParse({
      partnerId: formData.get("partnerId"),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      fullName: blankToNull(formData.get("fullName")),
      title: blankToNull(formData.get("title")),
      role: formData.get("role") ?? "member",
    });
  if (!parsed.success) return { error: "That does not look like a working email address." };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("partner_members").insert({
    partner_id: v.partnerId,
    email: v.email,
    full_name: v.fullName,
    title: v.title,
    role: v.role,
  });
  // The unique index on (partner_id, lower(email)) is what catches a repeat.
  if (error) {
    return error.code === "23505"
      ? { error: "That address is already on this partner." }
      : { error: "Could not add that member." };
  }

  revalidatePath("/admin/partners");
  return { ok: true };
}

export async function removePartnerMember(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("memberId"));
  if (!id.success) return { error: "Unknown member." };

  const supabase = await createClient();
  const { error } = await supabase.from("partner_members").delete().eq("id", id.data);
  if (error) return { error: "Could not remove that member." };

  revalidatePath("/admin/partners");
  return { ok: true };
}

/** Attach a body to a camp, or change the capacity it acts in. */
export async function linkCampPartner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      campId: z.uuid(),
      partnerId: z.uuid(),
      role: z.enum(["organisation", "blood_bank"]),
      isHost: z.coerce.boolean().optional(),
    })
    .safeParse({
      campId: formData.get("campId"),
      partnerId: formData.get("partnerId"),
      role: formData.get("role"),
      isHost: formData.get("isHost") === "on",
    });
  if (!parsed.success) return { error: "Pick a partner and a role." };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("camp_partners")
    .upsert(
      { camp_id: v.campId, partner_id: v.partnerId, role: v.role, is_host: v.isHost ?? false },
      { onConflict: "camp_id,partner_id" },
    );
  if (error) return { error: "Could not attach that partner." };

  revalidatePath("/admin/camps");
  revalidatePath("/");
  return { ok: true };
}

export async function unlinkCampPartner(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const campId = z.uuid().safeParse(formData.get("campId"));
  const partnerId = z.uuid().safeParse(formData.get("partnerId"));
  if (!campId.success || !partnerId.success) return { error: "Unknown partner." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("camp_partners")
    .delete()
    .eq("camp_id", campId.data)
    .eq("partner_id", partnerId.data);
  if (error) return { error: "Could not detach that partner." };

  revalidatePath("/admin/camps");
  revalidatePath("/");
  return { ok: true };
}
