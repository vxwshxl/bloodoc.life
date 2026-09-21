import "server-only";

import {
  renderEmail,
  heading,
  paragraph,
  infoCard,
  button,
  codeBlock,
  notice,
} from "@/lib/email/render";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://bloodoc.life";

/** The six-digit sign-in code. */
export function signInCodeEmail(code: string, minutes: number) {
  return {
    subject: `${code} is your BlooDoc sign-in code`,
    html: renderEmail({
      // The code goes in the preheader as well as the body: on a phone the
      // notification often shows enough of it to be read without opening
      // anything, which is the fastest this flow can possibly be.
      preheader: `Your sign-in code is ${code}. It expires in ${minutes} minutes.`,
      blocks: [
        heading("Your sign-in code"),
        paragraph("Enter this code on the BlooDoc sign-in page to continue. It expires in " + minutes + " minutes."),
        codeBlock(code),
        notice(
          "If you did not ask to sign in, you can ignore this email — the code is useless without your inbox, and nobody can sign in with it on your behalf.",
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
}) {
  return {
    subject: `You're registered — ${input.campTitle}`,
    html: renderEmail({
      preheader: `${input.when} · ${input.venue}`,
      blocks: [
        heading(`Thank you, ${input.donorName}.`),
        paragraph(
          "You are on the donor roster. Bring a photo ID on the day — it is the only thing you need to carry.",
        ),
        infoCard([
          { label: "Camp", value: input.campTitle, strong: true },
          { label: "When", value: input.when },
          { label: "Where", value: input.venue },
          { label: "Blood group", value: input.bloodGroup },
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
}) {
  return {
    subject: `Tomorrow: ${input.campTitle}`,
    html: renderEmail({
      preheader: `${input.when} · ${input.venue}`,
      blocks: [
        heading(`See you tomorrow, ${input.donorName}.`),
        paragraph("A short reminder about the camp you registered for."),
        infoCard([
          { label: "When", value: input.when, strong: true },
          { label: "Where", value: input.venue },
        ]),
        paragraph(
          "Sleep well tonight, eat before you come, and drink more water than usual. If you are unwell or on new medication, tell the desk when you arrive rather than staying away — a deferral is recorded and costs you nothing.",
          { muted: true },
        ),
      ],
    }),
  };
}
