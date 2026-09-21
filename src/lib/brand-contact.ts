/**
 * Contact details, in one place.
 *
 * They were written out in three formats in three files on the last project,
 * which is exactly how one of them ends up stale. Anything that needs to show
 * or link a number reads it from here.
 */

/** Digits only, no "+" or separators — what wa.me expects. */
export const CONTACT_PHONES = [
  { label: "+91 60031 81933", digits: "916003181933", whatsapp: true },
  { label: "+91 88228 51224", digits: "918822851224", whatsapp: true },
] as const;

export const CONTACT_PHONE = CONTACT_PHONES[0];
export const CONTACT_EMAIL = "hello@bloodoc.life";
export const CONTACT_EMAIL_HREF = `mailto:${CONTACT_EMAIL}`;
export const WHATSAPP_HREF = `https://wa.me/${CONTACT_PHONE.digits}`;

export const ORG_NAME = "BlooDoc";
export const ORG_CITY = "Guwahati";
export const ORG_REGION = "Assam";
export const ORG_COUNTRY = "IN";
export const ORG_ADDRESS = "Guwahati, Assam, India";
