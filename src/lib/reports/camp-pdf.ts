import "server-only";

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { RegistrationStatus } from "@/lib/db/types";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { MARK, RGU_LOGO, fitBox, loadLogo, type ReportImage } from "@/lib/reports/images";
import {
  STATUS_LABEL,
  bloodGroupLabel,
  bySchool,
  capitalise,
  countsLine,
  isRguCamp,
  reportSections,
  type CampReport,
  type ReportList,
  type ReportRow,
} from "@/lib/reports/camp-report";

/**
 * A camp's report as a PDF: the Excel workbook's letterhead and lists, for
 * printing and for anyone who opens a report on a phone.
 *
 * The same three lists as the workbook, each starting on its own page under the
 * full letterhead. A landscape page cannot hold all twenty-six of the
 * workbook's columns, so this carries the ones a camp is run from — who, what
 * group, how to reach them, the desk readings and the certificate number — and
 * leaves addresses, relations and medications to the spreadsheet.
 */

type RGB = [number, number, number];
const CRIMSON: RGB = [196, 31, 34];
const INK: RGB = [26, 26, 26];
const MUTED: RGB = [107, 107, 107];
const LINE: RGB = [228, 224, 218];

const STATUS_FILL: Record<RegistrationStatus, RGB> = {
  donated: [220, 242, 227],
  deferred: [251, 227, 214],
  cancelled: [237, 237, 237],
  registered: [255, 255, 255],
  screened: [230, 238, 251],
};

/** A4 landscape, in millimetres. */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 10;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLUMNS: { header: string; width?: number; value: (r: ReportRow, i: number) => string }[] = [
  { header: "S. No.", width: 10, value: (_r, i) => String(i + 1) },
  { header: "Name", width: 34, value: (r) => r.donor?.full_name ?? "" },
  { header: "Status", width: 17, value: (r) => STATUS_LABEL[r.status] },
  { header: "Blood group", width: 13, value: bloodGroupLabel },
  { header: "Donor type", width: 14, value: (r) => capitalise(r.donor?.kind) },
  {
    header: "School / department",
    value: (r) =>
      [r.donor?.school, r.donor?.department ?? r.donor?.occupation]
        .filter((s, i, all) => s && all.indexOf(s) === i)
        .join("\n"),
  },
  { header: "Sex", width: 11, value: (r) => capitalise(r.donor?.sex) },
  { header: "Age", width: 9, value: (r) => (r.donor?.age != null ? String(r.donor.age) : "") },
  { header: "Phone", width: 21, value: (r) => r.donor?.phone ?? "" },
  { header: "Weight (kg)", width: 13, value: (r) => (r.weight_kg != null ? String(r.weight_kg) : "") },
  {
    header: "BP",
    width: 14,
    value: (r) => (r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : ""),
  },
  { header: "Pulse", width: 11, value: (r) => (r.pulse_bpm != null ? String(r.pulse_bpm) : "") },
  { header: "Hb (g/dL)", width: 12, value: (r) => (r.hemoglobin_gdl != null ? String(r.hemoglobin_gdl) : "") },
  { header: "Certificate no.", width: 26, value: (r) => r.certificate_code ?? "" },
];

type Placed = CampReport["partners"][number] & { image: ReportImage | null };

/**
 * RGU's logo on top for an RGU camp, "Powered by" BlooDoc's mark and name
 * centred under it, a crimson rule, the collaborators with their logos, then the camp, the list's name and its totals. Returns where the
 * table starts.
 */
function letterhead(
  doc: jsPDF,
  { camp, partners, rgu }: { camp: CampReport["camp"]; partners: Placed[]; rgu: boolean },
  sectionName: string,
  counts: string,
): number {
  let y = MARGIN;
  const center = PAGE_W / 2;

  // The university's logo, centred, on an RGU camp's report.
  if (rgu) {
    const box = fitBox(RGU_LOGO, 80, 16);
    doc.addImage(RGU_LOGO.buffer, "PNG", center - box.width / 2, y, box.width, box.height, "rgu-logo");
    y += box.height + 3;
  }

  // "POWERED BY", then the mark and BLOODOC centred as one group.
  doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(...MUTED);
  doc.text("POWERED BY", center, y + 2, { align: "center" });
  y += 3.5;

  doc.setFont("helvetica", "bold").setFontSize(15);
  const bloodW = doc.getTextWidth("BLOOD");
  const groupW = 7 + 2 + bloodW + doc.getTextWidth("OC");
  const left = center - groupW / 2;
  doc.addImage(MARK.buffer, "PNG", left, y, 7, 7, "bloodoc-mark");
  doc.setTextColor(...INK).text("BLOOD", left + 9, y + 5.6);
  doc.setTextColor(...CRIMSON).text("OC", left + 9 + bloodW, y + 5.6);
  y += 9;
  doc.setDrawColor(...CRIMSON).setLineWidth(0.3).line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;

  if (partners.length) {
    doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(...MUTED);
    doc.text("IN COLLABORATION WITH", MARGIN, y + 2);
    y += 4;

    const hasLogos = partners.some((p) => p.image);
    const logoH = hasLogos ? 11 : 0;
    const slotW = CONTENT_W / partners.length;
    let bottom = y;
    partners.forEach((p, i) => {
      const center = MARGIN + slotW * i + slotW / 2;
      if (p.image) {
        const box = fitBox(p.image, slotW - 8, logoH);
        doc.addImage(
          p.image.buffer,
          p.image.extension === "png" ? "PNG" : "JPEG",
          center - box.width / 2,
          y + (logoH - box.height) / 2,
          box.width,
          box.height,
          `partner-logo-${i}`,
        );
      }
      let ty = y + logoH + 3;
      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...INK);
      const name = doc.splitTextToSize(p.name, slotW - 6) as string[];
      doc.text(name, center, ty, { align: "center" });
      ty += name.length * 3.2;
      doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
      const role = [p.kind === "blood_bank" ? "Blood bank partner" : "Organisation", p.note]
        .filter(Boolean)
        .join(" · ");
      const roleLines = doc.splitTextToSize(role, slotW - 6) as string[];
      doc.text(roleLines, center, ty, { align: "center" });
      bottom = Math.max(bottom, ty + roleLines.length * 2.6);
    });
    y = bottom + 1;
    doc.setDrawColor(...LINE).setLineWidth(0.2).line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  }

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
  doc.text(camp.title, MARGIN, y);
  const titleW = doc.getTextWidth(camp.title);
  doc.setFontSize(9).setTextColor(...CRIMSON).text(sectionName, MARGIN + titleW + 4, y);
  y += 4.5;

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  doc.text(
    [
      `${formatCampDate(camp.starts_at)}, ${formatTimeRange(camp.starts_at, camp.ends_at)}`,
      [camp.venue, camp.city].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("  ·  "),
    MARGIN,
    y,
  );
  y += 4;
  doc.setFont("helvetica", "bold").setTextColor(...INK).text(counts, MARGIN, y);
  return y + 4;
}

export async function buildCampPdf(
  { camp, partners, rows }: CampReport,
  origin: string,
  only?: ReportList,
): Promise<Buffer> {
  const logos = await Promise.all(
    partners.map((p) => (p.logo_url ? loadLogo(p.logo_url, origin) : Promise.resolve(null))),
  );
  const placed: Placed[] = partners.map((p, i) => ({ ...p, image: logos[i] }));
  const rgu = isRguCamp({ camp, partners, rows });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `${camp.title} — camp report`, creator: "BlooDoc", author: "BlooDoc" });

  // Which list each page belongs to, for its footer.
  const pageSection: string[] = [];

  reportSections(rows, only).forEach((section, s) => {
    if (s > 0) doc.addPage();
    const first = doc.getNumberOfPages();
    const startY = letterhead(doc, { camp, partners: placed, rgu }, section.name, countsLine(section.rows));

    if (!section.rows.length) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...MUTED);
      doc.text("Nobody in this list.", MARGIN, startY + 4);
    } else {
      const sorted = [...section.rows].sort(bySchool);
      autoTable(doc, {
        startY,
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN + 4, left: MARGIN },
        head: [COLUMNS.map((c) => c.header)],
        body: sorted.map((r, i) => COLUMNS.map((c) => c.value(r, i))),
        theme: "plain",
        rowPageBreak: "avoid",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4, textColor: INK, valign: "top" },
        headStyles: { fillColor: CRIMSON, textColor: [255, 255, 255], fontStyle: "bold", valign: "middle" },
        bodyStyles: { lineColor: LINE, lineWidth: { bottom: 0.15 } },
        columnStyles: Object.fromEntries(
          COLUMNS.flatMap((c, i) => (c.width ? [[i, { cellWidth: c.width }]] : [])),
        ),
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 2) {
            data.cell.styles.fillColor = STATUS_FILL[sorted[data.row.index].status];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    for (let p = first; p <= doc.getNumberOfPages(); p++) pageSection[p] = section.name;
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
    doc.text(pageSection[p] ?? "", MARGIN, PAGE_H - 6);
    doc.text(`Powered by BlooDoc · Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
