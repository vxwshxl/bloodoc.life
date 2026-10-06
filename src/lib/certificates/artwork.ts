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
   * longer matches what is printed here, the certificate paints over each line
   * that says it, in the artwork's own colours, and sets that line again from
   * the camp's record. Lines that mention neither are left alone, and an
   * unchanged camp gets the artwork untouched.
   */
  printed?: {
    title: string;
    /** `YYYY-MM-DD`, in IST. */
    date: string;
    lines: PrintedLine[];
  };
};

/**
 * One line of the artwork that names the camp or its date.
 *
 * The box is `left` / `right` distances from each edge (percent of width) and
 * `top` / `height` (percent of height), measured off the file, and is painted
 * `background` before the line is set in it.
 */
export type PrintedLine = {
  left: number;
  right: number;
  top: number;
  height: number;
  background: string;
  color: string;
  font: "serif" | "sans";
  /** Largest size, in percent of the image width. */
  size: number;
  uppercase?: boolean;
  /** Literal text, or the camp's `title` / `date`, each optionally bold. */
  parts: { text?: string; field?: "title" | "date"; bold?: boolean; color?: string }[];
};

export const CERTIFICATE_ART: Record<string, CertificateArt> = {
  "rgu-mega-drive-2026": {
    label: "Mega Blood Donation Drive 2026 — RGU",
    src: "/certificates/rgu-mega-drive-2026-v2.jpg",
    width: 3508,
    height: 2481,
    // The navy rule under "This is to provide certificate that": y = 1114px
    // of 2481, from x = 877px to 2630px of 3508. The baseline sits a little
    // above it so descenders clear the rule.
    name: { left: 25, right: 25, baseline: 44.5, color: "#7d1418" },
    // The clear strip between the signatures (ink ends y ≈ 2217px) and the
    // inner gold border (y = 2318px).
    code: { centre: 91.4, color: "#0d1d34" },
    // The blank paper between the RGU mark and the NSS seal: x 2100–2832px,
    // below the gold border (y 117px) and above "CERTIFICATE" (y 516px). The
    // QR is 309px from y 144px, and its label ends near y 495px.
    qr: { top: 5.8, right: 20.2, size: 8.8, color: "#0d1d34" },
    printed: {
      title: "Mega Blood Donation Drive",
      date: "2026-10-06",
      lines: [
        // "who has successfully donated in the “Mega Blood Donation Drive”",
        // ink y 1153–1218px, x 725–2781px; the patch (x 700–2810px) stops short
        // of the hand at 2817px.
        {
          left: 19.95,
          right: 19.9,
          top: 45.75,
          height: 3.83,
          background: "#ffffff",
          color: "#0d1d34",
          font: "sans",
          size: 1.8,
          parts: [
            { text: "who has successfully donated in the “" },
            { field: "title", bold: true },
            { text: "”" },
          ],
        },
        // "The Mega Blood Donation Drive was held on 6th October, 2026",
        // ink y 1345–1410px (cap height 44px), x 790–2715px.
        {
          left: 19.95,
          right: 19.9,
          top: 53.61,
          height: 3.83,
          background: "#ffffff",
          color: "#0d1d34",
          font: "sans",
          size: 1.8,
          parts: [
            { text: "The ", bold: true },
            { field: "title", bold: true },
            { text: " was held on " },
            { field: "date", bold: true },
          ],
        },
      ],
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
