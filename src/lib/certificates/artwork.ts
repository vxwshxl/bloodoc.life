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
  /**
   * Where the QR code goes: an empty patch of the artwork, as distances from
   * the top and right edges and a width, all percentages of the image width
   * except `top`, which is of its height.
   */
  qr: { top: number; right: number; size: number; color: string };
  /**
   * The camp's name as the organisers printed it, and where.
   *
   * The artwork is a picture, so renaming the camp in the console would leave
   * the old name on every certificate. When the camp's title (or date) no
   * longer matches what is printed here, the certificate paints over these
   * two boxes in the artwork's own colours and sets the current name in them.
   * When it does match, the artwork is shown untouched.
   *
   * Boxes are `left` / `right` distances from each edge (percent of width) and
   * `top` / `height` (percent of height), measured off the file.
   */
  printed?: {
    title: string;
    /** `YYYY-MM-DD`, in IST. */
    date: string;
    /** The name on the ribbon, inside its edges. */
    ribbon: { left: number; right: number; top: number; height: number; background: string; color: string };
    /** "The … was held on <date>", on the paper below it. */
    sentence: { left: number; right: number; top: number; height: number; background: string; color: string; accent: string };
  };
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
    // The blank corner right of the ABTYP mark: x 3160–3420px, from y 170px.
    qr: { top: 6.85, right: 2.5, size: 7.4, color: "#1f2a5c" },
    printed: {
      title: "Mega Blood Donation Drive",
      date: "2026-10-06",
      // The ribbon's flat band runs x 1010–2547px, y 1193–1303px; the patch
      // stays inside it so the band's own darker edges are kept.
      ribbon: {
        left: 29.65,
        right: 28.16,
        top: 48.59,
        height: 3.47,
        background: "linear-gradient(90deg, #961a18, #8a1210 50%, #8c1110)",
        color: "#ffffff",
      },
      // "The Mega Blood Donation Drive was held on 06th October, 2026",
      // y 1405–1460px, on plain paper wide enough for a longer name.
      sentence: {
        left: 24,
        right: 24,
        top: 56.45,
        height: 2.4,
        background: "#f7f6f2",
        color: "#14204f",
        accent: "#7a0f30",
      },
    },
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
