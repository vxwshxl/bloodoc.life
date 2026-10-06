import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCampPartners } from "@/lib/partners/queries";
import { buildCampWorkbook, type ReportPartner, type ReportRow } from "@/lib/reports/camp-workbook";
import type { Donor, Registration } from "@/lib/db/types";

/**
 * GET /admin/camps/:id/export — the camp's Excel report.
 *
 * On the administrator's own session, like every console read: RLS decides
 * which rows come back, and `requireAdmin` only gives a non-admin a better
 * landing than an empty file.
 */
// Node, not the edge: the workbook is built with exceljs and the logos with
// sharp. Never cached — it is a different file every time a donor registers.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Room for the logo fetches and a large roster on a cold start.
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Unknown camp.", { status: 404 });

  const supabase = await createClient();
  const { data: camp } = await supabase.from("camps").select("*").eq("id", id.data).maybeSingle();
  if (!camp) return new Response("Unknown camp.", { status: 404 });

  const [{ data }, linked] = await Promise.all([
    supabase
      .from("registrations")
      .select("*, donor:donors(*), certificate:certificates(code)")
      .eq("camp_id", camp.id)
      .order("created_at", { ascending: true }),
    getCampPartners(camp.id),
  ]);

  const rows: ReportRow[] = (
    (data as unknown as (Registration & {
      donor: Donor | null;
      // One per registration, but PostgREST may return the embed as a list.
      certificate: { code: string } | { code: string }[] | null;
    })[] | null) ?? []
  ).map(({ certificate, ...r }) => ({
    ...r,
    certificate_code: (Array.isArray(certificate) ? certificate[0] : certificate)?.code ?? null,
  }));

  // The linked partners carry logos, so they lead. The camp's free-text
  // credits fill in only for a side with no linked partner, as on the site.
  const sorted = [...linked].sort(
    (a, b) => Number(b.is_host) - Number(a.is_host) || a.sort_order - b.sort_order,
  );
  const partners: ReportPartner[] = sorted.map((r) => ({
    name: r.partner.name,
    kind: r.role,
    note: r.partner.parent_institution,
    logo_url: r.partner.logo_url,
  }));
  if (!partners.some((p) => p.kind === "organisation") && camp.collaboration) {
    partners.push({ name: camp.collaboration, kind: "organisation", note: null, logo_url: null });
  }
  if (!partners.some((p) => p.kind === "blood_bank") && camp.partner_name) {
    partners.push({ name: camp.partner_name, kind: "blood_bank", note: camp.partner_note, logo_url: null });
  }

  let file: Buffer;
  try {
    file = await buildCampWorkbook({
      camp,
      partners,
      rows,
      origin: new URL(request.url).origin,
    });
  } catch (error) {
    // Logged for the deployment's function logs, and said plainly to the
    // admin: a half-written download that Excel refuses to open tells nobody
    // what went wrong.
    console.error("[camp-report]", camp.id, error);
    return new Response("Could not build this camp's report. Try again in a moment.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const name = `${camp.title.replace(/[\\/:*?"<>|]+/g, "").trim() || "Camp"} - report ${stamp}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
