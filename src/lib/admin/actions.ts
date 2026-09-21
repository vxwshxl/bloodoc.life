"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/dal";
import { sendEmailNow, emailConfigured } from "@/lib/email/send";
import { campReminderEmail } from "@/lib/email/templates";
import { formatCampDate, formatTimeRange } from "@/lib/format";

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

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

const campSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(3, "Give the camp a title.").max(160),
  summary: z.string().trim().max(600).transform((s) => (s === "" ? null : s)),
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

  const startsAt = istToIso(v.startsAt);
  if (!startsAt) return { error: "That start time is not a valid date." };
  const endsAt = v.endsAt ? istToIso(v.endsAt) : null;
  if (endsAt && endsAt <= startsAt) return { error: "The camp cannot end before it starts." };

  const supabase = await createClient();
  const row = {
    title: v.title,
    summary: v.summary,
    venue: v.venue,
    city: v.city,
    starts_at: startsAt,
    ends_at: endsAt,
    capacity: v.capacity,
    status: v.status,
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
  await requireAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "That status is not one of the five." };
  const { id, status, deferralReason } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({
      status,
      // Clearing the reason when the status moves off "deferred" matters: a
      // stale "low haemoglobin" sitting on a row that now reads "donated" is
      // worse than no note at all.
      deferral_reason: status === "deferred" ? (deferralReason || null) : null,
    })
    .eq("id", id);
  if (error) return { error: "Could not update that registration." };

  revalidatePath("/admin/registrations");
  revalidatePath("/admin");
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
    const { subject, html } = campReminderEmail({
      donorName: d.full_name.split(" ")[0],
      campTitle: camp.title,
      when,
      venue,
    });
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
