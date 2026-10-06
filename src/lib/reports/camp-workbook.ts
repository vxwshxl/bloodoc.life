import "server-only";

import ExcelJS from "exceljs";
import type { Camp, RegistrationStatus } from "@/lib/db/types";
import { relationLine } from "@/lib/validations/donor";
import { formatCampDate, formatTimeRange } from "@/lib/format";
import { MARK, fitBox, loadLogo, type ReportImage } from "@/lib/reports/images";
import {
  STATUS_LABEL,
  bloodGroupLabel,
  bySchool,
  capitalise,
  countsLine,
  reportSections,
  type ReportPartner,
  type ReportRow,
} from "@/lib/reports/camp-report";

/**
 * A camp's report as an Excel workbook.
 *
 * What the organisers hand to the blood bank, the college and every body that
 * ran the drive. Three sheets — everybody, the faculty, the students — each
 * under the same letterhead: "Powered by" BlooDoc's mark and name, then every
 * collaborator's logo with its name and what it is, then the camp and its
 * totals. A sheet printed or forwarded on its own still says whose report it
 * is and who ran the drive.
 *
 * Staff and "other" donors are on the first sheet only; the organisers asked
 * for the two groups the college reports on.
 */

const CRIMSON = "FFC41F22";
const INK = "FF1A1A1A";
const MUTED = "FF6B6B6B";
const LINE = "FFE4E0DA";

const STATUS_FILL: Record<RegistrationStatus, string> = {
  donated: "FFDCF2E3",
  deferred: "FFFBE3D6",
  cancelled: "FFEDEDED",
  registered: "FFFFFFFF",
  screened: "FFE6EEFB",
};

type Placed = ReportPartner & { image: ReportImage | null };

function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(
    new Date(iso),
  );
}

const COLUMNS: { header: string; width: number; wrap?: boolean; value: (r: ReportRow, i: number) => ExcelJS.CellValue }[] = [
  { header: "S. No.", width: 7, value: (_r, i) => i + 1 },
  { header: "Name", width: 24, value: (r) => r.donor?.full_name ?? "" },
  { header: "Status", width: 12, value: (r) => STATUS_LABEL[r.status] },
  { header: "Blood group", width: 11, value: bloodGroupLabel },
  { header: "Donor type", width: 11, value: (r) => capitalise(r.donor?.kind) },
  { header: "School", width: 26, wrap: true, value: (r) => r.donor?.school ?? "" },
  { header: "Department", width: 26, wrap: true, value: (r) => r.donor?.department ?? r.donor?.occupation ?? "" },
  { header: "Sex", width: 9, value: (r) => capitalise(r.donor?.sex) },
  { header: "Age", width: 6, value: (r) => r.donor?.age ?? "" },
  { header: "Date of birth", width: 13, value: (r) => (r.donor?.date_of_birth ? shortDate(r.donor.date_of_birth) : "") },
  { header: "Phone", width: 13, value: (r) => r.donor?.phone ?? "" },
  { header: "Alternate phone", width: 14, value: (r) => r.donor?.alt_phone ?? "" },
  { header: "Email", width: 28, value: (r) => r.donor?.email ?? "" },
  { header: "Father / mother / spouse", width: 30, wrap: true, value: (r) => relationLine(r.donor) ?? "" },
  { header: "Residential address", width: 34, wrap: true, value: (r) => r.donor?.address ?? "" },
  { header: "Permanent address", width: 34, wrap: true, value: (r) => r.donor?.permanent_address ?? "" },
  { header: "First-time donor", width: 10, value: (r) => (r.first_time ? "Yes" : "No") },
  { header: "Donated before (said)", width: 11, value: (r) => r.donor?.prior_donations ?? "" },
  { header: "Height (cm)", width: 10, value: (r) => r.height_cm ?? "" },
  { header: "Weight (kg)", width: 10, value: (r) => r.weight_kg ?? "" },
  {
    header: "Blood pressure",
    width: 12,
    value: (r) => (r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : ""),
  },
  { header: "Pulse (/min)", width: 10, value: (r) => r.pulse_bpm ?? "" },
  { header: "Haemoglobin (g/dL)", width: 12, value: (r) => r.hemoglobin_gdl ?? "" },
  { header: "Medications", width: 24, wrap: true, value: (r) => r.medications ?? "" },
  { header: "Certificate no.", width: 17, value: (r) => r.certificate_code ?? "" },
  { header: "Registered at", width: 19, value: (r) => dateTime(r.created_at) },
];

/** How many columns the letterhead spans: about a printed page's width. */
const HEAD_COLS = 13;

/** Excel's rendering of a character-width column, in pixels. */
const colPx = (c: number) => Math.round(COLUMNS[c].width * 7 + 5);

/**
 * A point `px` from the sheet's left edge, as the column-and-fraction anchor
 * ExcelJS places images by. Images float over cells, so this is how one is
 * centred in a span of columns of different widths.
 */
function anchorX(px: number): number {
  let left = 0;
  for (let c = 0; c < COLUMNS.length; c++) {
    const w = colPx(c);
    if (px < left + w) return c + (px - left) / w;
    left += w;
  }
  return COLUMNS.length;
}

/**
 * Split the letterhead's columns into `n` runs of roughly equal width, one per
 * collaborator. Returns 0-based [first, last] column pairs.
 */
function slots(n: number): [number, number][] {
  const total = Array.from({ length: HEAD_COLS }, (_, c) => colPx(c)).reduce((a, b) => a + b, 0);
  const target = total / n;
  const out: [number, number][] = [];
  let start = 0;
  let acc = 0;
  for (let c = 0; c < HEAD_COLS; c++) {
    acc += colPx(c);
    const remainingSlots = n - out.length - 1;
    const remainingCols = HEAD_COLS - c - 1;
    if ((acc >= target * (out.length + 1) && remainingCols >= remainingSlots) || remainingCols === remainingSlots) {
      if (out.length < n - 1) {
        out.push([start, c]);
        start = c + 1;
      }
    }
  }
  out.push([start, HEAD_COLS - 1]);
  return out.slice(0, n);
}

const spanPx = ([a, b]: [number, number]) => {
  let left = 0;
  for (let c = 0; c < a; c++) left += colPx(c);
  let width = 0;
  for (let c = a; c <= b; c++) width += colPx(c);
  return { left, width };
};

/**
 * The letterhead: "Powered by" BlooDoc's mark and name, a crimson rule, then
 * "In collaboration with" and each collaborator's logo, name and role, then
 * the camp. Returns the row the table's header goes on.
 */
function letterhead(
  ws: ExcelJS.Worksheet,
  {
    markId,
    partners,
    logoIds,
    camp,
    sheetTitle,
    counts,
  }: {
    markId: number | null;
    partners: Placed[];
    logoIds: (number | null)[];
    camp: Camp;
    sheetTitle: string;
    counts: string;
  },
): number {
  const last = HEAD_COLS;

  // 1. "POWERED BY"
  ws.mergeCells(1, 1, 1, last);
  const powered = ws.getCell(1, 1);
  powered.value = "POWERED BY";
  powered.font = { bold: true, size: 7, color: { argb: MUTED } };
  powered.alignment = { vertical: "bottom", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 12;

  // 2. The mark, then BLOODOC with "OC" in crimson. Kept small: this is a
  // credit over a data sheet, not a cover page.
  ws.getRow(2).height = 22;
  if (markId !== null) {
    ws.addImage(markId, { tl: { col: 0.2, row: 1.08 }, ext: { width: 24, height: 24 } });
  }
  ws.mergeCells(2, 2, 2, last);
  const brand = ws.getCell(2, 2);
  brand.value = {
    richText: [
      { text: "BLOOD", font: { bold: true, size: 14, color: { argb: INK }, name: "Arial Black" } },
      { text: "OC", font: { bold: true, size: 14, color: { argb: CRIMSON }, name: "Arial Black" } },
    ],
  };
  brand.alignment = { vertical: "middle", horizontal: "left" };
  for (let c = 1; c <= last; c++) {
    ws.getCell(2, c).border = { bottom: { style: "thin", color: { argb: CRIMSON } } };
  }
  ws.getRow(3).height = 6;

  let row = 4;

  // 3. In collaboration with — one slot per collaborator.
  if (partners.length) {
    ws.mergeCells(row, 1, row, last);
    const label = ws.getCell(row, 1);
    label.value = "IN COLLABORATION WITH";
    label.font = { bold: true, size: 7, color: { argb: MUTED } };
    label.alignment = { indent: 1, vertical: "bottom" };
    ws.getRow(row).height = 12;
    row += 1;

    const logoRow = row;
    const hasLogos = logoIds.some((id) => id !== null);
    ws.getRow(logoRow).height = hasLogos ? 32 : 2;
    const spans = slots(partners.length);
    partners.forEach((p, i) => {
      const span = spans[i];
      const { left, width } = spanPx(span);
      const id = logoIds[i];
      if (id !== null && p.image) {
        const box = fitBox(p.image, width - 16, 38);
        ws.addImage(id, {
          tl: { col: anchorX(left + (width - box.width) / 2), row: logoRow - 1 + 0.06 },
          ext: box,
        });
      }
      ws.mergeCells(logoRow + 1, span[0] + 1, logoRow + 1, span[1] + 1);
      const name = ws.getCell(logoRow + 1, span[0] + 1);
      name.value = p.name;
      name.font = { bold: true, size: 8, color: { argb: INK } };
      name.alignment = { horizontal: "center", vertical: "top", wrapText: true };

      ws.mergeCells(logoRow + 2, span[0] + 1, logoRow + 2, span[1] + 1);
      const role = ws.getCell(logoRow + 2, span[0] + 1);
      role.value = [p.kind === "blood_bank" ? "Blood bank partner" : "Organisation", p.note]
        .filter(Boolean)
        .join(" · ");
      role.font = { size: 7, color: { argb: MUTED } };
      role.alignment = { horizontal: "center", vertical: "top", wrapText: true };
    });
    ws.getRow(logoRow + 1).height = 14;
    ws.getRow(logoRow + 2).height = 12;
    for (let c = 1; c <= last; c++) {
      ws.getCell(logoRow + 2, c).border = { bottom: { style: "thin", color: { argb: LINE } } };
    }
    ws.getRow(logoRow + 3).height = 6;
    row = logoRow + 4;
  }

  // 4. The camp, which sheet this is, and its totals.
  ws.mergeCells(row, 1, row, last);
  const title = ws.getCell(row, 1);
  title.value = {
    richText: [
      { text: camp.title, font: { bold: true, size: 11, color: { argb: INK } } },
      { text: `   ${sheetTitle}`, font: { bold: true, size: 9, color: { argb: CRIMSON } } },
    ],
  };
  title.alignment = { indent: 1, vertical: "middle" };
  ws.getRow(row).height = 16;
  row += 1;

  ws.mergeCells(row, 1, row, last);
  const facts = ws.getCell(row, 1);
  facts.value = [
    `${formatCampDate(camp.starts_at)}, ${formatTimeRange(camp.starts_at, camp.ends_at)}`,
    [camp.venue, camp.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join("  ·  ");
  facts.font = { size: 8, color: { argb: MUTED } };
  facts.alignment = { indent: 1 };
  row += 1;

  ws.mergeCells(row, 1, row, last);
  const totals = ws.getCell(row, 1);
  totals.value = counts;
  totals.font = { bold: true, size: 8, color: { argb: INK } };
  totals.alignment = { indent: 1 };
  ws.getRow(row + 1).height = 6;
  row += 2;

  return row;
}

function donorSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: ReportRow[],
  head: Omit<Parameters<typeof letterhead>[1], "sheetTitle" | "counts">,
) {
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: `&L${name}&RPowered by BlooDoc · Page &P of &N` },
  });
  COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

  const headerRowNo = letterhead(ws, {
    ...head,
    sheetTitle: name,
    counts: countsLine(rows),
  });

  const headerRow = ws.getRow(headerRowNo);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CRIMSON } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  headerRow.height = 32;
  // Frozen under the header, with the serial number and name kept in view.
  ws.views = [{ state: "frozen", ySplit: headerRowNo, xSplit: 2, showGridLines: false }];
  // The header repeats on every printed page.
  ws.pageSetup.printTitlesRow = `${headerRowNo}:${headerRowNo}`;

  const sorted = [...rows].sort(bySchool);
  sorted.forEach((r, i) => {
    const row = ws.getRow(headerRowNo + 1 + i);
    COLUMNS.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.value = c.value(r, i);
      cell.alignment = { vertical: "top", wrapText: !!c.wrap };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
    const status = row.getCell(3);
    status.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] } };
    status.font = { bold: true, size: 10 };
  });

  if (sorted.length) {
    ws.autoFilter = {
      from: { row: headerRowNo, column: 1 },
      to: { row: headerRowNo + sorted.length, column: COLUMNS.length },
    };
  } else {
    ws.getCell(headerRowNo + 1, 1).value = "Nobody in this list.";
    ws.getCell(headerRowNo + 1, 1).font = { italic: true, color: { argb: MUTED } };
  }
  return ws;
}

export async function buildCampWorkbook({
  camp,
  partners,
  rows,
  origin,
}: {
  camp: Camp;
  partners: ReportPartner[];
  rows: ReportRow[];
  origin: string;
}): Promise<Buffer> {
  const logos = await Promise.all(
    partners.map((p) => (p.logo_url ? loadLogo(p.logo_url, origin) : Promise.resolve(null))),
  );
  const placed: Placed[] = partners.map((p, i) => ({ ...p, image: logos[i] }));

  const wb = new ExcelJS.Workbook();
  wb.creator = "BlooDoc";
  wb.company = "BlooDoc";
  wb.title = `${camp.title} — camp report`;
  wb.created = new Date();

  // Each image is stored once and placed on every sheet.
  const markId = wb.addImage({ buffer: MARK.buffer as unknown as ExcelJS.Buffer, extension: "png" });
  const logoIds = placed.map((p) =>
    p.image
      ? wb.addImage({ buffer: p.image.buffer as unknown as ExcelJS.Buffer, extension: p.image.extension })
      : null,
  );
  const head = { markId, partners: placed, logoIds, camp };

  for (const section of reportSections(rows)) donorSheet(wb, section.name, section.rows, head);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
