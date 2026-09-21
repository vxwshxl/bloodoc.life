/**
 * The titles a camp is shown under, English first.
 *
 * A plain module rather than an export of `rotating-title.tsx`, because that
 * file is `"use client"` and the server components that build the page call
 * this to produce the array. Exporting a helper from a client module makes it a
 * client *reference*: calling it during a server render throws "Attempted to
 * call campTitles() from the server but campTitles is on the client."
 *
 * English is first and stays first. It is the accessible name for the rotating
 * heading, the reduced-motion fallback, and the one the page title and link
 * previews use.
 */
export function campTitles(camp: {
  title: string;
  title_as: string | null;
  title_hi: string | null;
}): string[] {
  return [camp.title, camp.title_as, camp.title_hi].filter(
    (t): t is string => !!t?.trim(),
  );
}
