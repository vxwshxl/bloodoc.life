import "server-only";

import { jsPDF } from "jspdf";
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
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const WASH: RGB = [251, 239, 238];

const WHY: { title: string; body: string }[] = [
  {
    title: "Registration in about two minutes",
    body: "Donors sign up on their phones from a link or QR. No paper slips, no typing them up after the camp.",
  },
  {
    title: "One donor record, start to finish",
    body: "The same entry is screened at the desk, builds the roster, sends the reminder and pre-fills the next camp.",
  },
  {
    title: "A live roster on camp day",
    body: "Every donor's screening status as it happens, filtered by blood group, department or status.",
  },
  {
    title: "Certificates the moment they donate",
    body: "Sent by email and WhatsApp, each with a QR code anyone can check at bloodoc.life/verify.",
  },
  {
    title: "A camp report with your name on it",
    body: "Excel or PDF under this same letterhead, with your logo, the totals and every donor listed.",
  },
  {
    title: "Donor privacy, built in",
    body: "Each donor sees only their own record. Medical decisions always stay with the medical officer at the camp.",
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

function letterPage(
  doc: jsPDF,
  report: CampReport,
  ctx: { partners: PlacedPartner[]; rgu: boolean; date: string },
  to: PlacedPartner | null,
) {
  const { camp, rows } = report;
  let y = drawLetterhead(doc, { partners: ctx.partners, rgu: ctx.rgu, pageW: PAGE_W, margin: MARGIN });

  // Heading line: what this is, and when.
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CRIMSON);
  doc.text("VOTE OF THANKS", MARGIN, y + 1, { charSpace: 0.8 });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(`Date: ${ctx.date}`, PAGE_W - MARGIN, y + 1, { align: "right" });
  y += 7;

  // Addressee.
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
  doc.text("To,", MARGIN, y);
  y += 4.6;
  doc.setFont("helvetica", "bold");
  y = paragraph(doc, to ? to.name : "All our partner organisations and collaborators", MARGIN, y, CONTENT_W, 4.6);
  if (to) {
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
    y = paragraph(doc, partnerRole(to), MARGIN, y, CONTENT_W, 4);
  }
  y += 3;

  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK);
  y = paragraph(doc, `Subject: Vote of thanks for ${camp.title}`, MARGIN, y, CONTENT_W, 4.6);
  y += 2.5;

  doc.setFont("helvetica", "normal");
  doc.text(to ? "Dear Sir/Madam," : "Dear Partners and Collaborators,", MARGIN, y);
  y += 6;

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
  for (const p of body) {
    y = paragraph(doc, p, MARGIN, y, CONTENT_W, 4.6) + 2.4;
  }
  y += 2;

  // Why BlooDoc: a washed panel, two columns of three.
  const pad = 5;
  const colGap = 7;
  const colW = (CONTENT_W - pad * 2 - colGap) / 2;
  const textW = colW - 6;
  doc.setFontSize(8);
  const itemH = WHY.map((w) => 4 + (doc.splitTextToSize(w.body, textW) as string[]).length * 3.5);
  const rowH = [0, 2, 4].map((i) => Math.max(itemH[i], itemH[i + 1]) + 2.5);
  const panelH = pad + 8 + rowH.reduce((a, b) => a + b, 0) + pad - 2.5;
  doc.setFillColor(...WASH).roundedRect(MARGIN, y, CONTENT_W, panelH, 1.2, 1.2, "F");

  let py = y + pad + 4;
  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...INK);
  const lead = "Why choose ";
  doc.text(lead, MARGIN + pad, py);
  const leadW = doc.getTextWidth(lead);
  doc.setTextColor(...CRIMSON).text("BlooDoc", MARGIN + pad + leadW, py);
  doc.setTextColor(...INK).text(" for your blood donation drive", MARGIN + pad + leadW + doc.getTextWidth("BlooDoc"), py);
  py += 6;

  WHY.forEach((w, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + pad + col * (colW + colGap);
    const iy = py + rowH.slice(0, row).reduce((a, b) => a + b, 0);
    // A crimson tile with a white cross, the plus from the mark.
    doc.setFillColor(...CRIMSON).roundedRect(x, iy - 2.9, 3.6, 3.6, 0.6, 0.6, "F");
    doc.setFillColor(255, 255, 255).rect(x + 1.5, iy - 2.3, 0.6, 2.4, "F").rect(x + 0.6, iy - 1.4, 2.4, 0.6, "F");
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK);
    doc.text(w.title, x + 6, iy);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(w.body, textW) as string[], x + 6, iy + 4);
  });
  y += panelH + 9;

  // Sign-off.
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED);
  doc.text("REGARDS,", MARGIN, y, { charSpace: 0.8 });
  y += 3;
  drawWordmark(doc, MARGIN, y, { size: 17, align: "left" });
  y += 13;

  // The ask, in a crimson band.
  const bandH = 15;
  doc.setFillColor(...CRIMSON).rect(MARGIN, y, CONTENT_W, bandH, "F");
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
  doc.text("Please be our partner for your next", MARGIN + 6, y + 6.3);
  doc.text("blood donation drive.", MARGIN + 6, y + 11);
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(CONTACT_EMAIL, PAGE_W - MARGIN - 6, y + 6.3, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(CONTACT_PHONES.map((p) => p.label).join("  ·  "), PAGE_W - MARGIN - 6, y + 11, { align: "right" });

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
  doc.text("bloodoc.life  ·  Blood donation camps, end to end  ·  Guwahati, Assam", MARGIN, PAGE_H - 8);
  doc.text("Powered by BlooDoc", PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
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
