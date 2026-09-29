/**
 * Certificate artwork an organiser designed for a particular camp.
 *
 * A camp's `certificate_art` names one of these; the certificate is then that
 * image with the donor's name printed on its blank line and the verification
 * code along the foot. Everything else — the logos, the date, the bodies that
 * ran the drive — is already in the artwork, because the organisers put it
 * there. A camp with no artwork gets the standard design, which draws the same
 * things from the camp's own data.
 *
 * Positions are percentages of the image, measured off the file itself, so the
 * overlay lands in the same place at any rendered size and on paper. They
 * belong to the image and live beside it: a new design is a file in
 * public/certificates and one entry here.
 */
export type CertificateArt = {
  label: string;
  src: string;
  /** Pixel size of the file, for the aspect ratio and for print. */
  width: number;
  height: number;
  /**
   * The line the name sits on. `left` and `right` are its ends, as distances
   * from each edge; `baseline` is how far down the image the line runs.
   */
  name: { left: number; right: number; baseline: number; color: string };
  /** The strip the verification code is printed in, as its centre line. */
  code: { centre: number; color: string };
};

export const CERTIFICATE_ART: Record<string, CertificateArt> = {
  "rgu-mega-drive-2026": {
    label: "Mega Blood Donation Drive 2026 — RGU",
    src: "/certificates/rgu-mega-drive-2026.jpg",
    width: 3508,
    height: 2482,
    // The gold rule under "This is to proudly certify that": y = 1095px of
    // 2482, from x = 858px to 2692px of 3508.
    name: { left: 24.5, right: 23.3, baseline: 43.7, color: "#7d1418" },
    // Between the inner gold border (y ≈ 2285px) and the paper edge.
    code: { centre: 94.4, color: "#1f2a5c" },
  },
};

/** What the camp form posts for "no artwork". Radix menus refuse "". */
export const STANDARD_CERTIFICATE = "standard";

export const CERTIFICATE_ART_OPTIONS = [
  { value: STANDARD_CERTIFICATE, label: "Standard design" },
  ...Object.entries(CERTIFICATE_ART).map(([value, a]) => ({ value, label: a.label })),
];

export function artFor(key: string | null | undefined): CertificateArt | null {
  return (key && CERTIFICATE_ART[key]) || null;
}
