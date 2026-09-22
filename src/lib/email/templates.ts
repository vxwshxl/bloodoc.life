import "server-only";

import type { TemplateCopy } from "@/lib/email/copy";

/**
 * Every template takes an optional `copy` override for its subject, heading and
 * lead paragraph. Blank or absent falls back to the wording written here, so a
 * half-filled row in `email_templates` still sends a complete email.
 *
 * The functions stay pure — no database, no network — which is what lets the
 * console preview one without sending it.
 */

import {
  renderEmail,
  heading,
  paragraph,
  infoCard,
  button,
  codeBlock,
  notice,
} from "@/lib/email/render";
import { SITE_URL } from "@/lib/site-url";

const site = () => SITE_URL;

/** The six-digit sign-in code. */
export function signInCodeEmail(code: string, minutes: number, copy?: TemplateCopy) {
  return {
    subject: copy?.subject || `${code} is your BlooDoc sign-in code`,
    html: renderEmail({
      // The code goes in the preheader as well as the body: on a phone the
      // notification often shows enough of it to be read without opening
      // anything, which is the fastest this flow can possibly be.
      preheader: `Your sign-in code is ${code}. It expires in ${minutes} minutes.`,
      blocks: [
        heading(copy?.heading || "Your sign-in code"),
        paragraph(
          copy?.lead ||
            `Enter this code on the BlooDoc sign-in page to continue. It expires in ${minutes} minutes.`,
        ),
        codeBlock(code),
        notice(
          "If you did not ask to sign in, you can ignore this email. The code is useless without your inbox, and nobody can sign in with it on your behalf.",
        ),
      ],
      footerNote: "This code was requested from the BlooDoc sign-in page.",
    }),
  };
}

/** Confirmation that a donor is on a camp's roster. */
export function registrationConfirmedEmail(input: {
  donorName: string;
  campTitle: string;
  when: string;
  venue: string;
  bloodGroup: string;
  collaboration?: string | null;
  partner?: string | null;
}, copy?: TemplateCopy) {
  return {
    subject: copy?.subject || `You're registered for ${input.campTitle}`,
    html: renderEmail({
      preheader: `${input.when} · ${input.venue}`,
      blocks: [
        heading(copy?.heading || `Thank you, ${input.donorName}.`),
        paragraph(
          copy?.lead ||
            "You are on the donor roster. Bring a photo ID on the day. It is the only thing you need to carry.",
        ),
        infoCard([
          { label: "Camp", value: input.campTitle, strong: true },
          { label: "When", value: input.when },
          { label: "Where", value: input.venue },
          { label: "Blood group", value: input.bloodGroup },
          ...(input.collaboration
            ? [{ label: "In collaboration with", value: input.collaboration }]
            : []),
          ...(input.partner ? [{ label: "Blood bank partner", value: input.partner }] : []),
        ]),
        button("View your registration", `${site()}/me`),
        paragraph(
          "Eat a normal meal and drink water before you come. Avoid alcohol for 24 hours beforehand, and bring the name of anything you are currently taking.",
          { muted: true },
        ),
        notice(
          "Final eligibility is decided by the medical officer at the camp after a short screening. Registering does not guarantee you will be able to donate on the day.",
        ),
      ],
      footerNote: "You are receiving this because you registered as a donor at bloodoc.life.",
    }),
  };
}

/** A nudge the day before. Sent from the console, not automatically. */
export function campReminderEmail(input: {
  donorName: string;
  campTitle: string;
  when: string;
  venue: string;
}, copy?: TemplateCopy) {
  return {
    subject: copy?.subject || `Tomorrow: ${input.campTitle}`,
    html: renderEmail({
      preheader: `${input.when} · ${input.venue}`,
      blocks: [
        heading(copy?.heading || `See you tomorrow, ${input.donorName}.`),
        paragraph(copy?.lead || "A short reminder about the camp you registered for."),
        infoCard([
          { label: "When", value: input.when, strong: true },
          { label: "Where", value: input.venue },
        ]),
        paragraph(
          "Sleep well tonight, eat before you come, and drink more water than usual. If you are unwell or on new medication, tell the desk when you arrive rather than staying away. A deferral is recorded and costs you nothing.",
          { muted: true },
        ),
      ],
    }),
  };
}

/**
 * Confirming a change to somebody's own donor record.
 *
 * A separate code from the sign-in one, with its own purpose, so a code
 * obtained for one cannot be replayed against the other — someone reading a
 * sign-in code over a shoulder must not be able to use it to rewrite the blood
 * group the desk will screen against.
 */
export function profileChangeCodeEmail(code: string, minutes: number, copy?: TemplateCopy) {
  return {
    subject: copy?.subject || `${code} confirms your BlooDoc profile change`,
    html: renderEmail({
      preheader: `Your confirmation code is ${code}. It expires in ${minutes} minutes.`,
      blocks: [
        heading(copy?.heading || "Confirm your changes"),
        paragraph(
          copy?.lead ||
            `Somebody — we hope you — is updating the donor record on this address. Enter this code to save the changes. It expires in ${minutes} minutes.`,
        ),
        codeBlock(code),
        notice(
          "If this was not you, ignore this email and nothing changes. Your record is only rewritten once this code is entered.",
        ),
      ],
      footerNote: "This code was requested from your profile page at bloodoc.life.",
    }),
  };
}

/**
 * "Somebody just signed in."
 *
 * Sent after every successful sign-in, not just unrecognised ones. A message
 * that only arrives when the system judges a login suspicious teaches people
 * that silence means safe — and the judgement is the part most likely to be
 * wrong. One every time is boring, which is the point: the one that matters
 * stands out because the reader knows they did not cause it.
 *
 * Every field is approximate and labelled so. An IP that resolves to the wrong
 * city is a support ticket; an IP presented as fact is a wrong accusation.
 */
export function signInAlertEmail(
  input: { device: string; location: string; ip: string; time: string },
  copy?: TemplateCopy,
) {
  return {
    subject: copy?.subject || "New sign-in to your BlooDoc account",
    html: renderEmail({
      preheader: `${input.device} · ${input.time}`,
      blocks: [
        heading(copy?.heading || "Somebody signed in"),
        paragraph(
          copy?.lead ||
            "Your BlooDoc account was just signed into. If that was you, nothing needs doing — this note is only so an unexpected one is never silent.",
        ),
        infoCard([
          { label: "When", value: input.time, strong: true },
          { label: "Device", value: input.device },
          { label: "Near", value: input.location },
          { label: "IP address", value: input.ip },
        ]),
        notice(
          "Location and device are approximate — they are worked out from the connection and can be wrong by a city or more. If this was not you, nobody can sign in again without a fresh code from this inbox, so change nothing and write to us.",
        ),
      ],
      footerNote: "You are receiving this because somebody signed into bloodoc.life with this address.",
    }),
  };
}
