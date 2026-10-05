import "server-only";

import ExcelJS from "exceljs";
import sharp from "sharp";
import type { Camp, Donor, Registration, RegistrationStatus } from "@/lib/db/types";
import { parentName } from "@/lib/validations/donor";
import { formatCampDate, formatTimeRange } from "@/lib/format";

/**
 * A camp's report as an Excel workbook.
 *
 * What the organisers hand to the blood bank, the college and every body that
 * ran the drive, so it carries all of them: BlooDoc's mark and name across the
 * top, each collaborator's logo and name in its own column under it, the
 * totals the organisers are asked for first (accepted, rejected, cancelled),
 * and then every registration with one column per answer.
 *
 * "Accepted" is a donation recorded, "rejected" a deferral at screening. Those
 * are the words the organisers use; the console's own words are kept beside
 * them in brackets so the two never read as different things.
 */

export type ReportPartner = {
  name: string;
  kind: "organisation" | "blood_bank";
  note: string | null;
  logo_url: string | null;
};

export type ReportRow = Registration & {
  donor: Donor | null;
  certificate_code: string | null;
};

const CRIMSON = "FFC41F22";
const INK = "FF1A1A1A";
const MUTED = "FF6B6B6B";
const LINE = "FFE4E0DA";
const HEAD = "FFF6F2EC";

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  donated: "Accepted (donated)",
  deferred: "Rejected (deferred)",
  cancelled: "Cancelled",
  registered: "Registered",
  screened: "Screened",
};

const STATUS_FILL: Record<RegistrationStatus, string> = {
  donated: "FFDCF2E3",
  deferred: "FFFBE3D6",
  cancelled: "FFEDEDED",
  registered: "FFFFFFFF",
  screened: "FFE6EEFB",
};

type Image = { buffer: Buffer; width: number; height: number };

/**
 * Any logo, as a PNG at most `max` px tall. Excel takes PNG and JPEG only, and
 * partners send SVG and WebP as often as not. Null when it cannot be fetched
 * or read: a missing logo leaves its name standing alone, never a failed report.
 */
async function loadImage(url: string, origin: string, max = 160): Promise<Image | null> {
  try {
    const res = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(input, { density: 300 })
      .resize({ height: max, width: max * 3, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

/** Fit an image into a box, keeping its shape. */
function fitBox(img: Image, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height);
  return { width: Math.round(img.width * scale), height: Math.round(img.height * scale) };
}

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

function sexLabel(s: string | undefined) {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}

/**
 * The BLOODOC band at the top of a sheet: the mark, the wordmark with "OC" in
 * crimson, and a line under it. Returns the next free row.
 */
function brandHeader(
  ws: ExcelJS.Worksheet,
  markId: number | null,
  width: number,
  subtitle: string,
): number {
  ws.getRow(1).height = 46;
  ws.getRow(2).height = 20;
  if (markId !== null) {
    ws.addImage(markId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 52, height: 52 } });
  }
  ws.mergeCells(1, 2, 1, width);
  const title = ws.getCell(1, 2);
  title.value = {
    richText: [
      { text: "BLOOD", font: { bold: true, size: 26, color: { argb: INK }, name: "Arial Black" } },
      { text: "OC", font: { bold: true, size: 26, color: { argb: CRIMSON }, name: "Arial Black" } },
    ],
  };
  title.alignment = { vertical: "middle", horizontal: "left" };

  ws.mergeCells(2, 2, 2, width);
  const sub = ws.getCell(2, 2);
  sub.value = subtitle;
  sub.font = { size: 10, color: { argb: MUTED } };
  sub.alignment = { vertical: "middle" };

  for (let c = 1; c <= width; c++) {
    ws.getCell(2, c).border = { bottom: { style: "medium", color: { argb: CRIMSON } } };
  }
  return 4;
}

/**
 * The collaborators, one per column: logo on top, name and role under it.
 * Returns the next free row.
 */
function collaboratorBand(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  row: number,
  partners: (ReportPartner & { image: Image | null })[],
  colWidthPx: number,
): number {
  if (!partners.length) return row;
  const label = ws.getCell(row, 1);
  label.value = "IN COLLABORATION WITH";
  label.font = { bold: true, size: 9, color: { argb: MUTED } };
  row += 1;

  const logoRow = row;
  ws.getRow(logoRow).height = 62;
  partners.forEach((p, i) => {
    const col = i + 1;
    if (p.image) {
      const box = fitBox(p.image, colWidthPx - 16, 70);
      const id = wb.addImage({ buffer: p.image.buffer as unknown as ExcelJS.Buffer, extension: "png" });
      // Centred in its column.
      const offset = (colWidthPx - box.width) / 2 / colWidthPx;
      ws.addImage(id, { tl: { col: i + offset, row: logoRow - 1 + 0.08 }, ext: box });
    }
    const name = ws.getCell(logoRow + 1, col);
    name.value = p.name;
    name.font = { bold: true, size: 10, color: { argb: INK } };
    name.alignment = { horizontal: "center", vertical: "top", wrapText: true };
    const role = ws.getCell(logoRow + 2, col);
    role.value = [p.kind === "blood_bank" ? "Blood bank partner" : "Organisation", p.note]
      .filter(Boolean)
      .join(" · ");
    role.font = { size: 8, color: { argb: MUTED } };
    role.alignment = { horizontal: "center", vertical: "top", wrapText: true };
  });
  ws.getRow(logoRow + 1).height = 30;
  ws.getRow(logoRow + 2).height = 26;
  return logoRow + 4;
}

const DONOR_COLUMNS: { header: string; width: number; value: (r: ReportRow, i: number) => ExcelJS.CellValue }[] = [
  { header: "S. No.", width: 7, value: (_r, i) => i + 1 },
  { header: "Name", width: 24, value: (r) => r.donor?.full_name ?? "" },
  { header: "Status", width: 20, value: (r) => STATUS_LABEL[r.status] },
  { header: "Reason (if rejected)", width: 26, value: (r) => r.deferral_reason ?? "" },
  { header: "Blood group", width: 11, value: (r) => (r.donor?.blood_group === "unknown" ? "Not known" : r.donor?.blood_group ?? "") },
  { header: "Sex", width: 9, value: (r) => sexLabel(r.donor?.sex) },
  { header: "Age", width: 6, value: (r) => r.donor?.age ?? "" },
  { header: "Date of birth", width: 13, value: (r) => (r.donor?.date_of_birth ? shortDate(r.donor.date_of_birth) : "") },
  { header: "Phone", width: 13, value: (r) => r.donor?.phone ?? "" },
  { header: "Alternate phone", width: 14, value: (r) => r.donor?.alt_phone ?? "" },
  { header: "Email", width: 28, value: (r) => r.donor?.email ?? "" },
  { header: "Father's name", width: 22, value: (r) => parentName(r.donor?.father_title, r.donor?.father_name) ?? "" },
  { header: "Mother's name", width: 22, value: (r) => parentName(r.donor?.mother_title, r.donor?.mother_name) ?? "" },
  { header: "Spouse's name", width: 22, value: (r) => parentName(r.donor?.husband_title, r.donor?.husband_name) ?? "" },
  { header: "Donor type", width: 11, value: (r) => sexLabel(r.donor?.kind) },
  { header: "School", width: 26, value: (r) => r.donor?.school ?? "" },
  { header: "Department", width: 26, value: (r) => r.donor?.department ?? "" },
  { header: "Occupation", width: 18, value: (r) => r.donor?.occupation ?? "" },
  { header: "Residential address", width: 34, value: (r) => r.donor?.address ?? "" },
  { header: "Permanent address", width: 34, value: (r) => r.donor?.permanent_address ?? "" },
  { header: "First-time donor", width: 10, value: (r) => (r.first_time ? "Yes" : "No") },
  { header: "Donated before (said)", width: 11, value: (r) => r.donor?.prior_donations ?? "" },
  { header: "Height (cm)", width: 10, value: (r) => r.height_cm ?? "" },
  { header: "Weight (kg)", width: 10, value: (r) => r.weight_kg ?? "" },
  {
    header: "Blood pressure",
    width: 12,
    value: (r) => (r.bp_systolic && r.bp_diastolic ? `${r.bp_systolic}/${r.bp_diastolic}` : ""),
  },
  { header: "Haemoglobin (g/dL)", width: 12, value: (r) => r.hemoglobin_gdl ?? "" },
  { header: "Medications", width: 24, value: (r) => r.medications ?? "" },
  { header: "Certificate no.", width: 17, value: (r) => r.certificate_code ?? "" },
  { header: "Registered at", width: 19, value: (r) => dateTime(r.created_at) },
];

function donorSheet(
  wb: ExcelJS.Workbook,
  name: string,
  rows: ReportRow[],
  markId: number | null,
  subtitle: string,
) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 4, xSplit: 2 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  DONOR_COLUMNS.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));
  brandHeader(ws, markId, Math.min(DONOR_COLUMNS.length, 12), subtitle);

  const headerRow = ws.getRow(4);
  DONOR_COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CRIMSON } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { right: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  headerRow.height = 32;

  rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    DONOR_COLUMNS.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.value = c.value(r, i);
      cell.alignment = { vertical: "top", wrapText: j >= 17 && j <= 19 };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
    const status = row.getCell(3);
    status.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STATUS_FILL[r.status] } };
    status.font = { bold: true, size: 10 };
  });

  if (rows.length) {
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: DONOR_COLUMNS.length } };
  } else {
    ws.getCell(5, 1).value = "Nobody in this list.";
    ws.getCell(5, 1).font = { italic: true, color: { argb: MUTED } };
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
  const [mark, ...logos] = await Promise.all([
    loadImage("/icon-512.png", origin, 200),
    ...partners.map((p) => (p.logo_url ? loadImage(p.logo_url, origin) : Promise.resolve(null))),
  ]);
  const withLogos = partners.map((p, i) => ({ ...p, image: logos[i] }));

  const wb = new ExcelJS.Workbook();
  wb.creator = "BlooDoc";
  wb.company = "BlooDoc";
  wb.title = `${camp.title} — camp report`;
  wb.created = new Date();
  // Stored once and placed on every sheet.
  const markId = mark
    ? wb.addImage({ buffer: mark.buffer as unknown as ExcelJS.Buffer, extension: "png" })
    : null;

  const when = `${formatCampDate(camp.starts_at)}, ${formatTimeRange(camp.starts_at, camp.ends_at)}`;
  const subtitle = `${camp.title} · ${formatCampDate(camp.starts_at)} · Powered by BlooDoc`;

  // --- Summary --------------------------------------------------------------
  const COLS = Math.max(5, withLogos.length);
  const COL_PX = 170;
  const ws = wb.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  for (let c = 1; c <= COLS; c++) ws.getColumn(c).width = COL_PX / 7;

  let row = brandHeader(ws, markId, COLS, "Camp report · Powered by BlooDoc");

  ws.mergeCells(row, 1, row, COLS);
  const heading = ws.getCell(row, 1);
  heading.value = camp.title;
  heading.font = { bold: true, size: 16, color: { argb: INK } };
  ws.getRow(row).height = 26;
  row += 1;

  const facts: [string, string | null][] = [
    ["When", when],
    ["Where", [camp.venue, camp.city].filter(Boolean).join(", ")],
    ["Organised by", camp.organiser],
    ["Report generated", dateTime(new Date().toISOString())],
  ];
  for (const [k, v] of facts) {
    if (!v) continue;
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { size: 10, color: { argb: MUTED } };
    ws.mergeCells(row, 2, row, COLS);
    ws.getCell(row, 2).value = v;
    ws.getCell(row, 2).font = { size: 10, color: { argb: INK } };
    row += 1;
  }
  row += 1;

  row = collaboratorBand(wb, ws, row, withLogos, COL_PX);

  // Totals, as tiles: the number big, the label under it.
  const count = (s: RegistrationStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const tiles: [string, number, string][] = [
    ["Total registered", rows.length, INK],
    ["Accepted (donated)", count(["donated"]), "FF1E7B3C"],
    ["Rejected (deferred)", count(["deferred"]), "FFB4471C"],
    ["Cancelled", count(["cancelled"]), "FF6B6B6B"],
    ["Not yet seen", count(["registered", "screened"]), "FF2D5BA8"],
  ];
  ws.getCell(row, 1).value = "TOTALS";
  ws.getCell(row, 1).font = { bold: true, size: 9, color: { argb: MUTED } };
  row += 1;
  ws.getRow(row).height = 40;
  ws.getRow(row + 1).height = 20;
  tiles.forEach(([label, n, color], i) => {
    const num = ws.getCell(row, i + 1);
    num.value = n;
    num.font = { bold: true, size: 24, color: { argb: color } };
    num.alignment = { horizontal: "center", vertical: "middle" };
    num.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
    const lab = ws.getCell(row + 1, i + 1);
    lab.value = label;
    lab.font = { bold: true, size: 9, color: { argb: MUTED } };
    lab.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    lab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD } };
    for (const c of [num, lab]) {
      c.border = {
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    }
  });
  row += 3;

  // Accepted donations by blood group: what the blood bank asks for next.
  const groups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"] as const;
  const donated = rows.filter((r) => r.status === "donated");
  ws.getCell(row, 1).value = "ACCEPTED, BY BLOOD GROUP";
  ws.getCell(row, 1).font = { bold: true, size: 9, color: { argb: MUTED } };
  row += 1;
  ws.getCell(row, 1).value = "Blood group";
  ws.getCell(row, 2).value = "Units";
  for (const c of [ws.getCell(row, 1), ws.getCell(row, 2)]) {
    c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CRIMSON } };
    c.alignment = { horizontal: "center" };
  }
  row += 1;
  for (const g of groups) {
    const n = donated.filter((r) => r.donor?.blood_group === g).length;
    if (g === "unknown" && n === 0) continue;
    ws.getCell(row, 1).value = g === "unknown" ? "Not known" : g;
    ws.getCell(row, 2).value = n;
    for (const c of [ws.getCell(row, 1), ws.getCell(row, 2)]) {
      c.alignment = { horizontal: "center" };
      c.border = { bottom: { style: "thin", color: { argb: LINE } } };
    }
    row += 1;
  }
  row += 1;
  ws.mergeCells(row, 1, row, COLS);
  const foot = ws.getCell(row, 1);
  foot.value =
    "Accepted = donation recorded. Rejected = deferred at screening by the medical officer. Full lists are on the next tabs.";
  foot.font = { italic: true, size: 9, color: { argb: MUTED } };

  // --- Lists ----------------------------------------------------------------
  donorSheet(wb, "All donors", rows, markId, subtitle);
  donorSheet(wb, "Accepted", rows.filter((r) => r.status === "donated"), markId, subtitle);
  donorSheet(wb, "Rejected", rows.filter((r) => r.status === "deferred"), markId, subtitle);
  donorSheet(wb, "Cancelled", rows.filter((r) => r.status === "cancelled"), markId, subtitle);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
