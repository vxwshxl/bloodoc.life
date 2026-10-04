import "server-only";

import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendEmailNow } from "@/lib/email/send";
import { certificateIssuedEmail } from "@/lib/email/templates";
import { copyFor } from "@/lib/email/copy";
import { formatCampDate } from "@/lib/format";
import { sendWhatsAppCertificate, whatsappConfigured } from "@/lib/whatsapp/send";

/**
 * Send a donor their certificate, if it is issued and has not been sent: by
 * email, and on WhatsApp to the phone on their record when that is set up.
 *
 * Called after anything that can record a donation or approve a certificate,
 * and safe to call when neither happened: `claim_certificate_email` (0021)
 * returns a row only for an approved certificate nobody has emailed yet, and
 * marks it sent in the same statement. That is what stops a second email when
 * a donated registration is re-saved, or when two people tap "Donated" at once.
 *
 * Runs on the caller's session, not the service role. The claim checks that
 * the caller is somebody who may record outcomes at that camp.
 *
 * Best-effort, like every other send. The donation is already recorded and the
 * certificate is already on the donor's dashboard. A mail outage is not a
 * reason to report the donation as failed, and the attempt is in the email log
 * either way.
 */
export async function emailCertificateFor(registrationId: string): Promise<void> {
  // Checked before claiming, so a site with neither channel configured does
  // not mark certificates as sent that never were.
  if (!emailConfigured() && !whatsappConfigured()) return;

  const supabase = await createClient();
  const { data } = await supabase.rpc("claim_certificate_email", {
    target_registration: registrationId,
  });
  const row = data?.[0];
  if (!row) return;
  await deliverCertificate(row);
}

export type CertificateEmailData = {
  code: string;
  donor_name: string;
  donor_email: string;
  /** For the WhatsApp copy. Null on a record with no phone. */
  donor_phone?: string | null;
  camp_title: string;
  camp_starts: string;
};

/**
 * Both channels, each best-effort and independent: a WhatsApp failure does
 * not stop the email, and the other way round. Returns what happened on each,
 * for the console's "Send certificate" button to report.
 */
export async function deliverCertificate(row: CertificateEmailData) {
  const [email, whatsapp] = await Promise.all([
    emailConfigured() && row.donor_email ? sendCertificateEmail(row) : Promise.resolve(null),
    whatsappConfigured() && row.donor_phone
      ? sendWhatsAppCertificate({
          phone: row.donor_phone,
          firstName: row.donor_name.split(" ")[0],
          campTitle: row.camp_title,
          campDate: formatCampDate(row.camp_starts),
          code: row.code,
        })
      : Promise.resolve(null),
  ]);
  return { email, whatsapp };
}

/**
 * Build and send the certificate email. No checks of its own: callers decide
 * whether it should go — `emailCertificateFor` through the once-only claim,
 * the console's "Send certificate" button on purpose, as many times as asked.
 */
export async function sendCertificateEmail(row: CertificateEmailData) {
  const firstName = row.donor_name.split(" ")[0];
  const copy = await copyFor("certificate_issued", {
    name: firstName,
    camp: row.camp_title,
    code: row.code,
  });
  const { subject, html } = certificateIssuedEmail(
    {
      donorName: firstName,
      campTitle: row.camp_title,
      campDate: formatCampDate(row.camp_starts),
      code: row.code,
    },
    copy,
  );
  return sendEmailNow({
    to: row.donor_email,
    toName: row.donor_name,
    subject,
    html,
    template: "certificate-issued",
  });
}
