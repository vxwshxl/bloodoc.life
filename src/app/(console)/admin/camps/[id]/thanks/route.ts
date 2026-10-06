import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { loadCampReport } from "@/lib/reports/camp-report";
import { buildThanksPdf } from "@/lib/reports/thanks-pdf";

/**
 * GET /admin/camps/:id/thanks — the camp's vote of thanks as a PDF, one page
 * per collaborator, under the camp report's letterhead.
 *
 * Read on the administrator's own session through `loadCampReport`, the same
 * as the export route next door.
 */
// Node for jsPDF's Buffer; never cached, since the date and totals move.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for the partner logo fetches on a cold start.
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Unknown camp.", { status: 404 });

  const report = await loadCampReport(id.data);
  if (!report) return new Response("Unknown camp.", { status: 404 });

  let file: Buffer;
  try {
    file = await buildThanksPdf(report, new URL(request.url).origin);
  } catch (error) {
    console.error("[camp-thanks]", report.camp.id, error);
    return new Response("Could not build this camp's vote of thanks. Try again in a moment.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const name = `${report.camp.title.replace(/[\\/:*?"<>|]+/g, "").trim() || "Camp"} - vote of thanks.pdf`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vote-of-thanks.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
