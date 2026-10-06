import "server-only";

import { GState, jsPDF } from "jspdf";
import { CONTACT_EMAIL, CONTACT_PHONES } from "@/lib/brand-contact";
import { formatCampDate } from "@/lib/format";
import { isRguCamp, type CampReport, type ReportPartner } from "@/lib/reports/camp-report";
import {
  CRIMSON,
  INK,
  MUTED,
  drawLetterhead,
  drawWordmark,
  partnerRole,
  placePartners,
  type PlacedPartner,
  type RGB,
} from "@/lib/reports/letterhead-pdf";

/**
 * A camp's vote of thanks: one A4 page per collaborator, each addressed to it,
 * under the same letterhead as the camp report (RGU's logo on an RGU camp,
 * "Powered by" BlooDoc, every collaborator's logo). A camp with no linked or
 * credited partner gets one page to all of them.
 *
 * The numbers are the camp's own: registrations on the roster and donations
 * recorded. They are left out until a donation has been recorded, so a letter
 * printed before the camp does not thank anyone for nothing.
 *
 * Drawn in jsPDF's built-in faces (Helvetica for the letter, Times italic for
 * the display lines), so nothing is fetched or embedded beyond the logos.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CRIMSON_DEEP: RGB = [142, 20, 24];
const WASH: RGB = [251, 239, 238];
/** Where the bottom block (sign-off, the ask, the footer) starts. */
const BOTTOM_Y = PAGE_H - 62;

const WHY: { title: string; body: string }[] = [
  {
    title: "Registration in about two minutes",
    body: "Donors sign up on their phones from a link or QR. No paper slips to type up after the camp.",
  },
  {
    title: "One donor record, start to finish",
    body: "The same entry is screened at the desk, builds the roster and pre-fills the next camp.",
  },
  {
    title: "A live roster on camp day",
    body: "Every donor's screening status as it happens, by blood group, department or status.",
  },
  {
    title: "Certificates the moment they donate",
    body: "By email and WhatsApp, each with a QR anyone can check at bloodoc.life/verify.",
  },
  {
    title: "A camp report with your name on it",
    body: "Excel or PDF under this letterhead, with your logo, the totals and every donor.",
  },
  {
    title: "Donor privacy, built in",
    body: "Each donor sees only their own record. The medical officer at the camp decides who donates.",
  },
];

const ROLE_THANKS: Record<ReportPartner["kind"] | "all", string> = {
  organisation:
    "You opened your doors, rallied your members, students and staff, and stood with us at the registration desk from early morning.",
  blood_bank:
    "Your medical officers, technicians and staff screened every donor with care and collected every unit safely.",
  all: "You opened your doors, rallied your people, and screened and cared for every donor who came forward.",
};

function todayIst(): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
}

/** Wrapped text from `y`; returns the y under its last line. */
function paragraph(doc: jsPDF, text: string, x: number, y: number, width: number, lineH: number): number {
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineH;
}

/** Runs of text side by side on one baseline, each in its own face and colour. */
function runs(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  parts: { text: string; font: [string, string]; color: RGB }[],
) {
  doc.setFontSize(size);
  for (const p of parts) {
    doc.setFont(...p.font).setTextColor(...p.color);
    doc.text(p.text, x, y);
    x += doc.getTextWidth(p.text);
  }
}

/**
 * The drop from public/brand/logo.svg as vector curves, its top point at
 * (`cx`, `top`). The SVG's arc is drawn as two quarter Béziers.
 */
function drawDrop(doc: jsPDF, cx: number, top: number, height: number, style: "F" | "S") {
  const s = height / 28.7;
  doc.lines(
    [
      [4.1, 4.5, 10.6, 12.7, 10.6, 18.1],
      [0, 5.854, -4.746, 10.6, -10.6, 10.6],
      [-5.854, 0, -10.6, -4.746, -10.6, -10.6],
      [0, -5.4, 6.5, -13.6, 10.6, -18.1],
    ],
    cx,
    top,
    [s, s],
    style,
    true,
  );
}

/** A left-to-right gradient as thin strips; jsPDF has no shading API worth the trouble. */
function gradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, from: RGB, to: RGB) {
  const steps = 90;
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    );
    doc.rect(x + i * sw, y, sw + 0.15, h, "F");
  }
}

/** A round stamp: two rings, the drop, and the text set around the ring. */
function drawSeal(doc: jsPDF, cx: number, cy: number, r: number, text: string, tilt: number) {
  doc.setDrawColor(...CRIMSON).setLineWidth(0.6).circle(cx, cy, r, "S");
  doc.setLineWidth(0.25).circle(cx, cy, r * 0.62, "S");
  doc.setFillColor(...CRIMSON);
  drawDrop(doc, cx, cy - r * 0.38, r * 0.7, "F");

  const ring = r * 0.74;
  doc.setFont("helvetica", "bold").setFontSize(5.6).setTextColor(...CRIMSON);
  const chars = [...text];
  const widths = chars.map((c) => doc.getTextWidth(c));
  const gap = (2 * Math.PI * ring - widths.reduce((a, b) => a + b, 0)) / chars.length;
  let theta = (tilt * Math.PI) / 180;
  chars.forEach((c, i) => {
    const mid = theta + widths[i] / 2 / ring;
    // Clockwise from the top; each glyph sits on the ring, tangent to it.
    const px = cx + ring * Math.sin(mid) - (widths[i] / 2) * Math.cos(mid);
    const py = cy - ring * Math.cos(mid) - (widths[i] / 2) * Math.sin(mid);
    doc.text(c, px, py, { angle: (-mid * 180) / Math.PI });
    theta += (widths[i] + gap) / ring;
  });
}

function letterPage(
  doc: jsPDF,
  report: CampReport,
  ctx: { partners: PlacedPartner[]; rgu: boolean; date: string },
  to: PlacedPartner | null,
) {
  const { camp, rows } = report;

  // The brand's red edge down the left, like a printed letterhead's bleed, and
  // a faint drop behind the letter.
  gradientRect(doc, 0, 0, 4, PAGE_H, CRIMSON, CRIMSON_DEEP);
  doc.setGState(new GState({ opacity: 0.045 }));
  doc.setFillColor(...CRIMSON);
  drawDrop(doc, PAGE_W - 30, 118, 120, "F");
  doc.setGState(new GState({ opacity: 1 }));

  let y = drawLetterhead(doc, { partners: ctx.partners, rgu: ctx.rgu, pageW: PAGE_W, margin: MARGIN });

  // Eyebrow and date, then the display line.
  doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...CRIMSON);
  doc.text("VOTE OF THANKS", MARGIN, y + 1, { charSpace: 0.9 });
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
  doc.text(`Date: ${ctx.date}`, PAGE_W - MARGIN, y + 1, { align: "right" });
  y += 10;
  runs(doc, MARGIN, y, 25, [
    { text: "With heartfelt ", font: ["times", "normal"], color: INK },
    { text: "gratitude", font: ["times", "italic"], color: CRIMSON },
  ]);
  y += 7.5;

  // Addressee and subject.
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text("To,", MARGIN, y);
  y += 4.4;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK);
  y = paragraph(doc, to ? to.name : "All our partner organisations and collaborators", MARGIN, y, CONTENT_W, 4.6);
  if (to) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
    y = paragraph(doc, partnerRole(to), MARGIN, y - 0.4, CONTENT_W, 4);
  }
  y += 2.5;
  doc.setFont("helvetica", "bold").setFontSize(9.3).setTextColor(...INK);
  y = paragraph(doc, `Subject: Vote of thanks for ${camp.title}`, MARGIN, y, CONTENT_W, 4.5);
  y += 2;

  doc.setFont("helvetica", "normal");
  doc.text(to ? "Dear Sir/Madam," : "Dear Partners and Collaborators,", MARGIN, y);
  y += 5.5;

  const where = [camp.venue, camp.city].filter(Boolean).join(", ");
  const donated = rows.filter((r) => r.status === "donated").length;
  const registered = rows.length;
  const body = [
    `On behalf of the entire BlooDoc team, thank you for standing with us for ${camp.title} on ${formatCampDate(camp.starts_at)}${where ? ` at ${where}` : ""}. ${ROLE_THANKS[to?.kind ?? "all"]} Most of all, you trusted us with something as serious as blood donation.`,
    donated
      ? `Together we saw ${registered} ${registered === 1 ? "donor" : "donors"} register and ${donated} ${donated === 1 ? "donation" : "donations"} recorded. Each unit can help save up to three lives, and none of it would have happened without you.`
      : null,
    "We promise to keep earning your trust: running every camp with care, protecting every donor's information, and making each drive easier for you than the last.",
  ].filter((p): p is string => !!p);
  doc.setFontSize(9.3).setTextColor(...INK);
  for (const p of body) {
    y = paragraph(doc, p, MARGIN, y, CONTENT_W, 4.35) + 2;
  }
  y += 2.5;

  // Why BlooDoc: a washed panel with a crimson rule on top, two columns of three.
  const pad = 5;
  const colGap = 7;
  const colW = (CONTENT_W - pad * 2 - colGap) / 2;
  const textW = colW - 6;
  doc.setFont("helvetica", "normal").setFontSize(7.8);
  const itemH = WHY.map((w) => 3.8 + (doc.splitTextToSize(w.body, textW) as string[]).length * 3.3);
  const rowH = [0, 2, 4].map((i) => Math.max(itemH[i], itemH[i + 1]) + 2.2);
  const panelH = pad + 9 + rowH.reduce((a, b) => a + b, 0) + pad - 3;
  doc.setFillColor(...WASH).rect(MARGIN, y, CONTENT_W, panelH, "F");
  doc.setFillColor(...CRIMSON).rect(MARGIN, y, CONTENT_W, 0.8, "F");

  let py = y + pad + 4.5;
  runs(doc, MARGIN + pad, py, 15, [
    { text: "Why choose ", font: ["times", "normal"], color: INK },
    { text: "BlooDoc", font: ["times", "italic"], color: CRIMSON },
    { text: " for your blood donation drive", font: ["times", "normal"], color: INK },
  ]);
  py += 6.5;

  WHY.forEach((w, i) => {
    const x = MARGIN + pad + (i % 2) * (colW + colGap);
    const iy = py + rowH.slice(0, Math.floor(i / 2)).reduce((a, b) => a + b, 0);
    // A crimson tile with a white cross, the plus from the mark.
    doc.setFillColor(...CRIMSON).roundedRect(x, iy - 2.9, 3.6, 3.6, 0.6, 0.6, "F");
    doc.setFillColor(255, 255, 255).rect(x + 1.5, iy - 2.3, 0.6, 2.4, "F").rect(x + 0.6, iy - 1.4, 2.4, 0.6, "F");
    doc.setFont("helvetica", "bold").setFontSize(8.4).setTextColor(...INK);
    doc.text(w.title, x + 6, iy);
    doc.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(w.body, textW) as string[], x + 6, iy + 3.8);
  });
  y += panelH;

  // The bottom block sits at a fixed height so every page ends the same way;
  // a letterhead with many partners pushes it down only if it has to.
  y = Math.max(y + 7, BOTTOM_Y);

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...MUTED);
  doc.text("REGARDS,", MARGIN, y + 6, { charSpace: 0.9 });
  drawWordmark(doc, MARGIN, y + 9, { size: 19, align: "left" });
  drawSeal(doc, PAGE_W - MARGIN - 17, y + 12, 13, "BLOODOC  ·  BLOOD DONATION CAMPS  ·  GUWAHATI  ·  ", -12);
  y += 28;

  // The ask, on a deep-to-bright crimson band.
  const bandH = 17;
  gradientRect(doc, MARGIN, y, CONTENT_W, bandH, CRIMSON_DEEP, CRIMSON);
  doc.setFont("times", "italic").setFontSize(15).setTextColor(255, 255, 255);
  doc.text("Please be our partner for your", MARGIN + 6, y + 7.3);
  doc.text("next blood donation drive.", MARGIN + 6, y + 13.3);
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(CONTACT_EMAIL, PAGE_W - MARGIN - 6, y + 7.3, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(7.8);
  doc.text(CONTACT_PHONES.map((p) => p.label).join("  ·  "), PAGE_W - MARGIN - 6, y + 12.3, { align: "right" });

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
  doc.text("bloodoc.life  ·  Blood donation camps, end to end  ·  Guwahati, Assam", MARGIN, PAGE_H - 8);
  doc.setFont("helvetica", "bold").setTextColor(...CRIMSON);
  doc.text("A+   A-   B+   B-   AB+   AB-   O+   O-", PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
}

export async function buildThanksPdf(report: CampReport, origin: string): Promise<Buffer> {
  const partners = await placePartners(report.partners, origin);
  const ctx = { partners, rgu: isRguCamp(report), date: todayIst() };

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `${report.camp.title} — vote of thanks`, creator: "BlooDoc", author: "BlooDoc" });

  const recipients: (PlacedPartner | null)[] = partners.length ? partners : [null];
  recipients.forEach((to, i) => {
    if (i > 0) doc.addPage();
    letterPage(doc, report, ctx, to);
  });

  return Buffer.from(doc.output("arraybuffer"));
}
