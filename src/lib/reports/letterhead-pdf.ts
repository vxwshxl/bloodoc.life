import "server-only";

import type { jsPDF } from "jspdf";
import { MARK, RGU_LOGO, fitBox, loadLogo, type ReportImage } from "@/lib/reports/images";
import type { ReportPartner } from "@/lib/reports/camp-report";

/**
 * The letterhead every BlooDoc PDF opens with: RGU's logo on an RGU camp,
 * "Powered by" BlooDoc's mark and name centred, a crimson rule, then the
 * collaborators with their logos. The camp report (landscape) and the vote of
 * thanks (portrait) both draw it, so it takes the page's width and margin.
 */

export type RGB = [number, number, number];
export const CRIMSON: RGB = [196, 31, 34];
export const INK: RGB = [26, 26, 26];
export const MUTED: RGB = [107, 107, 107];
export const LINE: RGB = [228, 224, 218];

export type PlacedPartner = ReportPartner & { image: ReportImage | null };

/** Each partner with its logo fetched; a logo that fails leaves the name alone. */
export async function placePartners(partners: ReportPartner[], origin: string): Promise<PlacedPartner[]> {
  const logos = await Promise.all(
    partners.map((p) => (p.logo_url ? loadLogo(p.logo_url, origin) : Promise.resolve(null))),
  );
  return partners.map((p, i) => ({ ...p, image: logos[i] }));
}

/**
 * BlooDoc's mark, then BLOOD in ink and OC in crimson, as one group: centred
 * on `x`, or starting at it with `align: "left"`.
 */
export function drawWordmark(
  doc: jsPDF,
  x: number,
  y: number,
  { size = 15, align = "center" }: { size?: number; align?: "center" | "left" } = {},
) {
  const mark = (size / 15) * 7;
  doc.setFont("helvetica", "bold").setFontSize(size);
  const bloodW = doc.getTextWidth("BLOOD");
  const groupW = mark + 2 + bloodW + doc.getTextWidth("OC");
  const left = align === "left" ? x : x - groupW / 2;
  doc.addImage(MARK.buffer, "PNG", left, y, mark, mark, "bloodoc-mark");
  const baseline = y + mark * 0.8;
  doc.setTextColor(...INK).text("BLOOD", left + mark + 2, baseline);
  doc.setTextColor(...CRIMSON).text("OC", left + mark + 2 + bloodW, baseline);
}

/** Draws the letterhead from the top margin down; returns the y it ends at. */
export function drawLetterhead(
  doc: jsPDF,
  { partners, rgu, pageW, margin }: { partners: PlacedPartner[]; rgu: boolean; pageW: number; margin: number },
): number {
  let y = margin;
  const center = pageW / 2;
  const contentW = pageW - margin * 2;

  // The university's logo, centred, on an RGU camp.
  if (rgu) {
    const box = fitBox(RGU_LOGO, 80, 16);
    doc.addImage(RGU_LOGO.buffer, "PNG", center - box.width / 2, y, box.width, box.height, "rgu-logo");
    y += box.height + 3;
  }

  doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(...MUTED);
  doc.text("POWERED BY", center, y + 2, { align: "center" });
  y += 3.5;
  drawWordmark(doc, center, y);
  y += 9;
  doc.setDrawColor(...CRIMSON).setLineWidth(0.3).line(margin, y, pageW - margin, y);
  y += 4;

  if (!partners.length) return y;

  doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(...MUTED);
  doc.text("IN COLLABORATION WITH", margin, y + 2);
  y += 4;

  const hasLogos = partners.some((p) => p.image);
  const logoH = hasLogos ? 11 : 0;
  const slotW = contentW / partners.length;
  let bottom = y;
  partners.forEach((p, i) => {
    const slotCenter = margin + slotW * i + slotW / 2;
    if (p.image) {
      const box = fitBox(p.image, slotW - 8, logoH);
      doc.addImage(
        p.image.buffer,
        p.image.extension === "png" ? "PNG" : "JPEG",
        slotCenter - box.width / 2,
        y + (logoH - box.height) / 2,
        box.width,
        box.height,
        `partner-logo-${i}`,
      );
    }
    let ty = y + logoH + 3;
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...INK);
    const name = doc.splitTextToSize(p.name, slotW - 6) as string[];
    doc.text(name, slotCenter, ty, { align: "center" });
    ty += name.length * 3.2;
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
    const roleLines = doc.splitTextToSize(partnerRole(p), slotW - 6) as string[];
    doc.text(roleLines, slotCenter, ty, { align: "center" });
    bottom = Math.max(bottom, ty + roleLines.length * 2.6);
  });
  y = bottom + 1;
  doc.setDrawColor(...LINE).setLineWidth(0.2).line(margin, y, pageW - margin, y);
  return y + 5;
}

export function partnerRole(p: ReportPartner): string {
  return [p.kind === "blood_bank" ? "Blood bank partner" : "Organisation", p.note].filter(Boolean).join(" · ");
}
