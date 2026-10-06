import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { REPORT_LISTS, loadCampReport, reportFileName, type ReportList } from "@/lib/reports/camp-report";
import { buildCampWorkbook } from "@/lib/reports/camp-workbook";
import { buildCampPdf } from "@/lib/reports/camp-pdf";

/**
 * GET /admin/camps/:id/export — the camp's report, as Excel by default or as
 * a PDF with `?format=pdf`. All three lists by default; `?list=all`,
 * `?list=faculty` or `?list=students` gives just that one.
 *
 * On the administrator's own session, like every console read: RLS decides
 * which rows come back, and `requireAdmin` only gives a non-admin a better
 * landing than an empty file.
 */
// Node, not the edge: exceljs and jsPDF want Node's Buffer. Neither report
// touches a native module — sharp's libvips is not reliably in the function
// bundle on Vercel, and loading it took the whole route down. Never cached:
// it is a different file every time a donor registers.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for the logo fetches and a large roster on a cold start.
export const maxDuration = 60;

const TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Unknown camp.", { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const list = url.searchParams.get("list");
  const only = list && Object.hasOwn(REPORT_LISTS, list) ? (list as ReportList) : undefined;

  const report = await loadCampReport(id.data);
  if (!report) return new Response("Unknown camp.", { status: 404 });

  let file: Buffer;
  try {
    file =
      format === "pdf"
        ? await buildCampPdf(report, url.origin, only)
        : await buildCampWorkbook({ ...report, origin: url.origin, only });
  } catch (error) {
    // Logged for the deployment's function logs, and said plainly to the
    // admin: a half-written download that Excel refuses to open tells nobody
    // what went wrong.
    console.error("[camp-report]", format, report.camp.id, error);
    return new Response("Could not build this camp's report. Try again in a moment.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const name = reportFileName(report.camp, format, only);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="report.${format}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
